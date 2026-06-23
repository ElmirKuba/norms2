import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { GoalNotFoundError } from '../../../../shared/errors/goal-not-found.error';
import { GoalMaxDepthReachedError } from '../../../../shared/errors/goal-max-depth-reached.error';
import { GoalPausedError } from '../../../../shared/errors/goal-paused.error';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import type { Env } from '../../../../system/config/env.schema';
import { ACCENT_GOAL_REPOSITORY } from '../adapters/accent-goal-repository.port';
import type {
  AccentGoalRepositoryPort,
  GoalCreateData,
  GoalListFilters,
  GoalUpdateData,
} from '../adapters/accent-goal-repository.port';
import { ACCENT_GOAL_ENTRY_REPOSITORY } from '../adapters/accent-goal-entry-repository.port';
import type { AccentGoalEntryRepositoryPort } from '../adapters/accent-goal-entry-repository.port';
import { ACCENT_MILESTONE_REPOSITORY } from '../adapters/accent-milestone-repository.port';
import type { AccentMilestoneRepositoryPort } from '../adapters/accent-milestone-repository.port';
import { GOAL_DIRECTIONS } from '../interfaces/goal-full.interface';
import type { GoalDirection, GoalFull } from '../interfaces/goal-full.interface';
import type { GoalEntryFull } from '../interfaces/goal-entry-full.interface';
import type { MilestoneFull } from '../interfaces/milestone-full.interface';
import { computeGoalProgress, isGoalReached, isMilestoneReached } from '../goal-progress.util';
import type { GoalProgress } from '../goal-progress.util';

/** Веха с вычисленной достигнутостью (для проекции наружу). */
export interface MilestoneWithReached {
  /** Веха. */
  milestone: MilestoneFull;
  /** Достигнута ли (вычислено из текущего прогресса цели). */
  reached: boolean;
}

/** Максимальная длина названия цели. */
const TITLE_MAX = 160;
/** Максимальная длина единицы измерения. */
const UNIT_MAX = 32;

/**
 * Domain-service целей: per-account CRUD с проверкой владения и инвариантами рода
 * (ADR-0052). Зависит только от порта + конфига (чистые границы). Инварианты →
 * `VALIDATION_ERROR`; глубина дерева (из `ACCENT_GOAL_MAX_DEPTH`) → `GOAL_MAX_DEPTH_REACHED`
 * (422); `GoalNotFoundError` 404. **Без version** — прогресс вычисляется на чтение (·9),
 * здесь только нормализация/валидация и запись. Экспортится для кросс-домена вниз
 * (привычка→прогресс цели, 2.5·13).
 */
@Injectable()
export class AccentGoalDomainService {
  /**
   * @param _repository Порт репозитория целей.
   * @param _config Конфиг (глубина дерева).
   */
  public constructor(
    @Inject(ACCENT_GOAL_REPOSITORY) private readonly _repository: AccentGoalRepositoryPort,
    @Inject(ACCENT_GOAL_ENTRY_REPOSITORY)
    private readonly _entryRepository: AccentGoalEntryRepositoryPort,
    @Inject(ACCENT_MILESTONE_REPOSITORY)
    private readonly _milestoneRepository: AccentMilestoneRepositoryPort,
    private readonly _config: ConfigService<Env, true>,
  ) {}

  /**
   * Цели аккаунта (опц. фильтр статус/сфера).
   * @param accountId Идентификатор аккаунта.
   * @param filters Фильтр.
   * @returns Список целей владельца.
   */
  public async list(accountId: string, filters?: GoalListFilters): Promise<GoalFull[]> {
    return this._repository.listByAccount(accountId, filters);
  }

  /**
   * Цель владельца или 404.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Цель.
   * @throws {GoalNotFoundError} Если нет / не ваша.
   */
  public async getOwned(id: string, accountId: string): Promise<GoalFull> {
    const found = await this._repository.findOwned(id, accountId);
    if (!found) {
      throw new GoalNotFoundError('Цель не найдена.');
    }
    return found;
  }

  /**
   * Прямые подцели цели (для rollup/иерархии).
   * @param parentGoalId Идентификатор родительской цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Список подцелей.
   */
  public async listChildren(parentGoalId: string, accountId: string): Promise<GoalFull[]> {
    return this._repository.listChildren(parentGoalId, accountId);
  }

  /**
   * Создаёт цель после валидации (рода/значений/глубины).
   * @param data Данные создания (с `accountId`).
   * @returns Созданная цель.
   * @throws {ValidationError} При нарушении инвариантов.
   * @throws {GoalNotFoundError} Если родитель не найден / не ваш.
   * @throws {GoalMaxDepthReachedError} При превышении глубины.
   */
  public async create(data: GoalCreateData): Promise<GoalFull> {
    const title = this._normalizeTitle(data.title);
    const unit = this._normalizeUnit(data.unit);
    this._assertDirection(data.direction);
    this._assertValues(data.direction, data.targetValue, data.startValue ?? null);
    if (data.parentGoalId != null) {
      await this._assertParentDepthOk(data.parentGoalId, data.accountId);
    }
    return this._repository.create({ ...data, title, unit });
  }

  /**
   * Обновляет цель владельца (частично; last-write-wins). Валидирует только переданные
   * поля; `direction`/`startValue` не меняются (иммутабельны после создания).
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая цель.
   * @throws {GoalNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} При нарушении инвариантов.
   */
  public async update(
    id: string,
    accountId: string,
    patch: GoalUpdateData,
  ): Promise<GoalFull> {
    const current = await this.getOwned(id, accountId);
    const next: GoalUpdateData = { ...patch };
    if (patch.title !== undefined) {
      next.title = this._normalizeTitle(patch.title);
    }
    if (patch.unit !== undefined) {
      next.unit = this._normalizeUnit(patch.unit);
    }
    // Новый target проверяем против рода и неизменной startValue.
    if (patch.targetValue !== undefined) {
      this._assertValues(current.direction, patch.targetValue, current.startValue);
    }
    const updated = await this._repository.update(id, accountId, next);
    if (!updated) {
      throw new GoalNotFoundError('Цель не найдена.');
    }
    return updated;
  }

  /**
   * Ставит цель на паузу (из `active`). На паузе цель не принимает записи прогресса.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Цель на паузе.
   * @throws {GoalNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если цель не в статусе `active`.
   */
  public async pause(id: string, accountId: string): Promise<GoalFull> {
    const updated = await this._repository.pause(id, accountId);
    return updated ?? this._failTransition(id, accountId, 'на паузу можно поставить только активную цель');
  }

  /**
   * Снимает паузу (из `paused`) — закрытый период паузы уходит в историю (для `activeDays`).
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Активная цель.
   * @throws {GoalNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если цель не в статусе `paused`.
   */
  public async resume(id: string, accountId: string): Promise<GoalFull> {
    const updated = await this._repository.resume(id, accountId);
    return updated ?? this._failTransition(id, accountId, 'снять с паузы можно только приостановленную цель');
  }

  /**
   * Архивирует цель (из `active|paused|completed`) — уходит из дашборда, не удаляется.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Архивированная цель.
   * @throws {GoalNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если цель уже архивирована.
   */
  public async archive(id: string, accountId: string): Promise<GoalFull> {
    const updated = await this._repository.archive(id, accountId);
    return updated ?? this._failTransition(id, accountId, 'цель уже архивирована');
  }

  /**
   * Восстанавливает из архива (из `archived`) в `active`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Активная цель.
   * @throws {GoalNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если цель не в архиве.
   */
  public async restore(id: string, accountId: string): Promise<GoalFull> {
    const updated = await this._repository.restore(id, accountId);
    return updated ?? this._failTransition(id, accountId, 'восстановить можно только архивированную цель');
  }

  /**
   * Добавляет запись прогресса к цели (append-only) и при достижении target — авто-завершает
   * (атомарно, идемпотентно; ADR-0052). На паузе → `GOAL_PAUSED` 409; в архиве → `VALIDATION_ERROR`.
   * @param goalId Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param data Значение/дата/заметка (дата по умолчанию — сегодня в TZ).
   * @param timezone TZ пользователя (для даты по умолчанию).
   * @returns Созданная запись + актуальная цель (возможно завершённая).
   * @throws {GoalNotFoundError} Если нет / не ваша.
   * @throws {GoalPausedError} Если цель на паузе.
   * @throws {ValidationError} Архив / некорректное значение.
   */
  public async addEntry(
    goalId: string,
    accountId: string,
    data: { value: number; occurredOn?: string | null; note?: string | null },
    timezone: string,
  ): Promise<{ entry: GoalEntryFull; goal: GoalFull }> {
    const goal = await this.getOwned(goalId, accountId);
    if (goal.status === 'paused') {
      throw new GoalPausedError('Цель на паузе — записи не принимаются.');
    }
    if (goal.status === 'archived') {
      throw new ValidationError('Цель в архиве — записи не принимаются.');
    }
    if (!Number.isFinite(data.value)) {
      throw new ValidationError('Значение записи должно быть числом.');
    }
    if (goal.direction === 'accumulate' && data.value === 0) {
      throw new ValidationError('Для накопительной цели значение записи не может быть 0.');
    }
    const occurredOn = data.occurredOn ?? todayInTimezone(timezone);
    const entry = await this._entryRepository.add({
      goalId,
      value: data.value,
      occurredOn,
      note: data.note ?? null,
    });
    // Пересчёт текущего значения и идемпотентное авто-завершение.
    let resulting = goal;
    if (goal.status === 'active') {
      const { current, base } = await this._currentAndBase(goal);
      if (isGoalReached(goal, current, base)) {
        const completed = await this._repository.markCompleted(goalId, accountId);
        if (completed) {
          resulting = completed;
        }
      }
    }
    return { entry, goal: resulting };
  }

  /**
   * История записей цели (новые сверху, курсор по `id`). Проверяет владение.
   * @param goalId Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param cursor Курсор (id последней полученной) или undefined.
   * @param limit Размер страницы.
   * @returns Страница записей.
   * @throws {GoalNotFoundError} Если нет / не ваша.
   */
  public async listEntries(
    goalId: string,
    accountId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<GoalEntryFull[]> {
    await this.getOwned(goalId, accountId);
    return this._entryRepository.listByGoal(goalId, { cursor, limit });
  }

  /**
   * Считает вычисляемый прогресс цели (currentValue/%/forecast/…, ADR-0052) из её записей.
   * @param goal Цель.
   * @param timezone TZ пользователя (для «сегодня» в daysLeft).
   * @returns Вычисляемый прогресс.
   */
  public async describe(goal: GoalFull, timezone: string): Promise<GoalProgress> {
    const { current, base } = await this._currentAndBase(goal);
    return computeGoalProgress(goal, current, base, todayInTimezone(timezone), new Date());
  }

  /**
   * Добавляет веху к цели. Валидирует: название непусто; `thresholdValue` конечно; для
   * `accumulate` — `0 < threshold ≤ targetValue` (для reach/reduce порог — уровень замера,
   * без жёсткой границы).
   * @param goalId Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param data Название + порог.
   * @returns Созданная веха.
   * @throws {GoalNotFoundError} Если цели нет / не ваша.
   * @throws {ValidationError} При нарушении инвариантов.
   */
  public async addMilestone(
    goalId: string,
    accountId: string,
    data: { title: string; thresholdValue: number },
  ): Promise<MilestoneFull> {
    const goal = await this.getOwned(goalId, accountId);
    const title = data.title.trim();
    if (title.length === 0) {
      throw new ValidationError('Название вехи не может быть пустым.');
    }
    if (title.length > TITLE_MAX) {
      throw new ValidationError(`Название вехи длиннее ${TITLE_MAX} символов.`);
    }
    if (!Number.isFinite(data.thresholdValue)) {
      throw new ValidationError('Порог вехи должен быть числом.');
    }
    if (goal.direction === 'accumulate') {
      if (data.thresholdValue <= 0 || data.thresholdValue > goal.targetValue) {
        throw new ValidationError('Порог вехи должен быть в диапазоне (0, цель].');
      }
    }
    return this._milestoneRepository.add({ goalId, title, thresholdValue: data.thresholdValue });
  }

  /**
   * Вехи цели с вычисленной достигнутостью (по текущему прогрессу). Проверяет владение.
   * @param goalId Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Вехи + флаг `reached` на каждой.
   * @throws {GoalNotFoundError} Если нет / не ваша.
   */
  public async listMilestones(
    goalId: string,
    accountId: string,
  ): Promise<MilestoneWithReached[]> {
    const goal = await this.getOwned(goalId, accountId);
    const { current, base } = await this._currentAndBase(goal);
    const items = await this._milestoneRepository.listByGoal(goalId);
    return items.map((milestone) => ({
      milestone,
      reached: isMilestoneReached(goal, milestone.thresholdValue, current, base),
    }));
  }

  /**
   * Удаляет веху цели — **только не достигнутую** (domain-model §4). Достигнутую веху не
   * трогаем (она факт истории/награды).
   * @param goalId Идентификатор цели.
   * @param milestoneId Идентификатор вехи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @throws {GoalNotFoundError} Если цели/вехи нет / не ваша.
   * @throws {ValidationError} Если веха уже достигнута.
   */
  public async removeMilestone(
    goalId: string,
    milestoneId: string,
    accountId: string,
  ): Promise<void> {
    const goal = await this.getOwned(goalId, accountId);
    const milestone = await this._milestoneRepository.findInGoal(milestoneId, goalId);
    if (!milestone) {
      throw new GoalNotFoundError('Веха не найдена.');
    }
    const { current, base } = await this._currentAndBase(goal);
    if (isMilestoneReached(goal, milestone.thresholdValue, current, base)) {
      throw new ValidationError('Достигнутую веху удалить нельзя.');
    }
    await this._milestoneRepository.remove(milestoneId, goalId);
  }

  /**
   * Текущее значение и база цели из записей (ADR-0052). accumulate: current=Σ, base=0;
   * reach/reduce: base=startValue ?? первый замер, current=последний замер ?? base.
   * @param goal Цель.
   * @returns `{ current, base }` (любое поле может быть null, если посчитать нельзя).
   */
  private async _currentAndBase(
    goal: GoalFull,
  ): Promise<{ current: number | null; base: number | null }> {
    if (goal.direction === 'accumulate') {
      return { current: await this._entryRepository.sumValue(goal.id), base: 0 };
    }
    const base =
      goal.startValue ?? (await this._entryRepository.earliestValue(goal.id));
    const latest = await this._entryRepository.latestValue(goal.id);
    return { current: latest ?? base, base };
  }

  /**
   * Разбирает причину неуспеха атомарного перехода: нет строки → 404; есть, но статус не
   * тот → `VALIDATION_ERROR` с понятным сообщением. Никогда не возвращает (всегда бросает).
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param reason Человекочитаемая причина (для `VALIDATION_ERROR`).
   * @returns Никогда (для удобства вызова `?? this._failTransition(...)`).
   * @throws {GoalNotFoundError} Если цели нет / не ваша.
   * @throws {ValidationError} Если цель есть, но в неподходящем статусе.
   */
  private async _failTransition(
    id: string,
    accountId: string,
    reason: string,
  ): Promise<never> {
    await this.getOwned(id, accountId); // бросит 404, если нет/не ваша
    throw new ValidationError(`Недопустимый переход: ${reason}.`);
  }

  /**
   * Нормализует и валидирует название.
   * @param raw Сырое название.
   * @returns Подрезанное название.
   * @throws {ValidationError} Пустое или длиннее лимита.
   */
  private _normalizeTitle(raw: string): string {
    const title = raw.trim();
    if (title.length === 0) {
      throw new ValidationError('Название цели не может быть пустым.');
    }
    if (title.length > TITLE_MAX) {
      throw new ValidationError(`Название цели длиннее ${TITLE_MAX} символов.`);
    }
    return title;
  }

  /**
   * Нормализует и валидирует единицу измерения.
   * @param raw Сырая единица.
   * @returns Подрезанная единица.
   * @throws {ValidationError} Пустая или длиннее лимита.
   */
  private _normalizeUnit(raw: string): string {
    const unit = raw.trim();
    if (unit.length === 0) {
      throw new ValidationError('Единица измерения не может быть пустой.');
    }
    if (unit.length > UNIT_MAX) {
      throw new ValidationError(`Единица измерения длиннее ${UNIT_MAX} символов.`);
    }
    return unit;
  }

  /**
   * Проверяет, что род цели — из допустимого множества.
   * @param direction Род цели.
   * @throws {ValidationError} Неизвестный род.
   */
  private _assertDirection(direction: GoalDirection): void {
    if (!GOAL_DIRECTIONS.includes(direction)) {
      throw new ValidationError('Неизвестный род цели (direction).');
    }
  }

  /**
   * Проверяет числовые инварианты значения по роду (ADR-0052): accumulate `target>0`;
   * reach/reduce `target≠start` (при известном start; защита от деления на ноль в доле).
   * @param direction Род цели.
   * @param target Целевое значение.
   * @param start Базовый замер или null.
   * @throws {ValidationError} При нарушении.
   */
  private _assertValues(
    direction: GoalDirection,
    target: number,
    start: number | null,
  ): void {
    if (!Number.isFinite(target)) {
      throw new ValidationError('Целевое значение должно быть числом.');
    }
    if (direction === 'accumulate') {
      if (target <= 0) {
        throw new ValidationError('Для накопительной цели целевое значение должно быть > 0.');
      }
      return;
    }
    // reach / reduce
    if (start !== null && !Number.isFinite(start)) {
      throw new ValidationError('Базовый замер должен быть числом.');
    }
    if (start !== null && target === start) {
      throw new ValidationError('Целевое значение должно отличаться от базового замера.');
    }
  }

  /**
   * Проверяет, что добавление подцели к `parentGoalId` не превысит `ACCENT_GOAL_MAX_DEPTH`.
   * Идёт вверх по цепочке родителей (с защитой от циклов). Родитель должен существовать
   * и принадлежать аккаунту.
   * @param parentGoalId Идентификатор родителя.
   * @param accountId Идентификатор аккаунта-владельца.
   * @throws {GoalNotFoundError} Родитель не найден / не ваш.
   * @throws {GoalMaxDepthReachedError} Глубина превышена.
   */
  private async _assertParentDepthOk(
    parentGoalId: string,
    accountId: string,
  ): Promise<void> {
    const maxDepth = this._config.get('ACCENT_GOAL_MAX_DEPTH', { infer: true });
    // Глубина родителя = число узлов от него вверх до корня. newDepth = parentDepth + 1.
    let parentDepth = 0;
    let cursorId: string | null = parentGoalId;
    while (cursorId !== null) {
      const node: GoalFull | null = await this._repository.findOwned(cursorId, accountId);
      if (!node) {
        throw new GoalNotFoundError('Родительская цель не найдена.');
      }
      parentDepth += 1;
      if (parentDepth > maxDepth) {
        // Дерево глубже лимита (страховка от циклов/повреждённых данных).
        break;
      }
      cursorId = node.parentGoalId;
    }
    if (parentDepth + 1 > maxDepth) {
      throw new GoalMaxDepthReachedError(
        `Слишком глубокая вложенность целей (максимум ${maxDepth}).`,
      );
    }
  }
}

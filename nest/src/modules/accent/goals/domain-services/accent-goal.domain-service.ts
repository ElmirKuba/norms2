import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { GoalNotFoundError } from '../../../../shared/errors/goal-not-found.error';
import { GoalMaxDepthReachedError } from '../../../../shared/errors/goal-max-depth-reached.error';
import type { Env } from '../../../../system/config/env.schema';
import { ACCENT_GOAL_REPOSITORY } from '../adapters/accent-goal-repository.port';
import type {
  AccentGoalRepositoryPort,
  GoalCreateData,
  GoalListFilters,
  GoalUpdateData,
} from '../adapters/accent-goal-repository.port';
import { GOAL_DIRECTIONS } from '../interfaces/goal-full.interface';
import type { GoalDirection, GoalFull } from '../interfaces/goal-full.interface';

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

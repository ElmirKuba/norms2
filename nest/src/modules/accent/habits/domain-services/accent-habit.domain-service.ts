import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { HabitNotFoundError } from '../../../../shared/errors/habit-not-found.error';
import { ACCENT_HABIT_REPOSITORY } from '../adapters/accent-habit-repository.port';
import type {
  AccentHabitRepositoryPort,
  HabitCreateData,
  HabitUpdateData,
} from '../adapters/accent-habit-repository.port';
import { HABIT_KINDS, LADDER_POLICIES } from '../interfaces/habit-full.interface';
import type { HabitFull, HabitKind, HabitLadder } from '../interfaces/habit-full.interface';
import { isValidRecurrence } from '../recurrence.util';
import { STARTER_HABITS } from '../seed/starter-habits';

/** Максимальная длина названия привычки. */
const TITLE_MAX = 120;

/**
 * Domain-service привычек: per-account CRUD с инвариантами лесенки и проверкой владения.
 * Зависит только от порта (чистые границы). Инварианты лесенки
 * (`minTarget≤currentTarget≤goalTarget`, step>0 при adaptive) и базовая валидность RRULE
 * → `VALIDATION_ERROR`; `HabitNotFoundError` 404. Счётчики `easyStreak`/`missStreak` ставит
 * сам (на create — 0; на edit лесенки — сохраняет из существующей). Экспортится для
 * кросс-домена вниз (материализация задач 2.4·8, цели 2.5). Полный разбор RRULE — на 2.4·6.
 */
@Injectable()
export class AccentHabitDomainService {
  /**
   * @param _repository Порт репозитория привычек.
   */
  public constructor(
    @Inject(ACCENT_HABIT_REPOSITORY) private readonly _repository: AccentHabitRepositoryPort,
  ) {}

  /**
   * Активные привычки аккаунта.
   * @param accountId Идентификатор аккаунта.
   * @returns Список привычек владельца.
   */
  public async list(accountId: string): Promise<HabitFull[]> {
    return this._repository.listByAccount(accountId);
  }

  /**
   * Привычка владельца или 404.
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Привычка.
   * @throws {HabitNotFoundError} Если нет / не ваша.
   */
  public async getOwned(id: string, accountId: string): Promise<HabitFull> {
    const found = await this._repository.findOwned(id, accountId);
    if (!found) {
      throw new HabitNotFoundError('Привычка не найдена.');
    }
    return found;
  }

  /**
   * Привычка владельца или null (без 404) — для движка лесенки (мягкий путь).
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Привычка или null.
   */
  public async findOwnedOrNull(id: string, accountId: string): Promise<HabitFull | null> {
    return this._repository.findOwned(id, accountId);
  }

  /**
   * Записывает лесенку привычки целиком (включая счётчики) — для `LadderEngine`. В обход
   * слияния счётчиков из `update` (то — для пользовательских правок целей лесенки).
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ladder Новая лесенка.
   */
  public async setLadder(id: string, accountId: string, ladder: HabitLadder): Promise<void> {
    await this._repository.update(id, accountId, { ladder });
  }

  /**
   * Создаёт привычку после валидации.
   * @param data Данные создания (с `accountId`).
   * @returns Созданная привычка.
   * @throws {ValidationError} При нарушении инвариантов.
   */
  public async create(data: HabitCreateData): Promise<HabitFull> {
    const title = this._validateTitle(data.title);
    this._validateKind(data.kind);
    this._validateRecurrence(data.recurrence);
    this._validateLadder(data.ladder);
    const ladder: HabitLadder = { ...data.ladder, easyStreak: 0, missStreak: 0 };
    return this._repository.create({ ...data, title, ladder });
  }

  /**
   * Обновляет привычку владельца (валидирует переданные поля; счётчики лесенки сохраняет).
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая привычка.
   * @throws {ValidationError} При нарушении инвариантов.
   * @throws {HabitNotFoundError} Если нет / не ваша.
   */
  public async update(
    id: string,
    accountId: string,
    patch: HabitUpdateData,
  ): Promise<HabitFull> {
    const clean: HabitUpdateData = {};
    if (patch.title !== undefined) {
      clean.title = this._validateTitle(patch.title);
    }
    if (patch.kind !== undefined) {
      this._validateKind(patch.kind);
      clean.kind = patch.kind;
    }
    if (patch.recurrence !== undefined) {
      this._validateRecurrence(patch.recurrence);
      clean.recurrence = patch.recurrence;
    }
    if (patch.description !== undefined) {
      clean.description = patch.description;
    }
    if (patch.icon !== undefined) {
      clean.icon = patch.icon;
    }
    if (patch.domainKey !== undefined) {
      clean.domainKey = patch.domainKey;
    }
    if (patch.attributes !== undefined) {
      clean.attributes = patch.attributes;
    }
    if (patch.goalId !== undefined) {
      clean.goalId = patch.goalId;
    }
    if (patch.priority !== undefined) {
      clean.priority = patch.priority;
    }
    if (patch.minVersion !== undefined) {
      clean.minVersion = patch.minVersion;
    }
    if (patch.isActive !== undefined) {
      clean.isActive = patch.isActive;
    }
    // Adoption (ADR-0051): любое редактирование «присваивает» пример (снимает флаг).
    clean.isStarter = false;
    if (patch.ladder !== undefined) {
      this._validateLadder(patch.ladder);
      // Сохраняем счётчики прогресса при редактировании целей лесенки.
      const existing = await this.getOwned(id, accountId);
      clean.ladder = {
        ...patch.ladder,
        easyStreak: existing.ladder.easyStreak,
        missStreak: existing.ladder.missStreak,
      };
    }
    const updated = await this._repository.update(id, accountId, clean);
    if (!updated) {
      throw new HabitNotFoundError('Привычка не найдена.');
    }
    return updated;
  }

  /**
   * Засевает стартовый пак привычек (по кнопке «Получить пак», ADR-0051): создаёт привычки
   * из `STARTER_HABITS` с `is_starter=true`. **Только докидывает** недостающие (дедуп по
   * названию, своё не трогает). Данные — доверенные константы, доменная валидация не нужна.
   * @param accountId Идентификатор аккаунта.
   * @returns Число созданных примеров (0 если все уже есть).
   */
  public async seedStarterPack(accountId: string): Promise<number> {
    const existing = await this._repository.listByAccount(accountId);
    const existingTitles = new Set(existing.map((habit) => habit.title));
    const toSeed: HabitCreateData[] = STARTER_HABITS.filter(
      (item) => !existingTitles.has(item.title),
    ).map((item) => ({
      accountId,
      title: item.title,
      kind: item.kind,
      recurrence: item.recurrence,
      ladder: item.ladder,
      description: item.description,
      icon: item.icon,
      attributes: item.attributes,
      minVersion: item.minVersion,
      isStarter: true,
    }));
    return this._repository.createMany(toSeed);
  }

  /**
   * Очищает примеры: удаляет ещё не присвоенные стартовые привычки (`is_starter=true`).
   * Свои (присвоенные) не трогает.
   * @param accountId Идентификатор аккаунта.
   * @returns Число удалённых.
   */
  public async clearStarters(accountId: string): Promise<number> {
    return this._repository.deleteStarters(accountId);
  }

  /**
   * Присваивает пример («Добавить себе», ADR-0051): снимает `is_starter` → привычка
   * становится обычной (начинает материализовать задачи и двигать лесенку).
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая привычка.
   * @throws {HabitNotFoundError} Если нет / не ваша.
   */
  public async adopt(id: string, accountId: string): Promise<HabitFull> {
    const updated = await this._repository.update(id, accountId, { isStarter: false });
    if (!updated) {
      throw new HabitNotFoundError('Привычка не найдена.');
    }
    return updated;
  }

  /**
   * Деактивирует привычку (мягко: `isActive=false`; из материализации исчезает).
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая привычка.
   * @throws {HabitNotFoundError} Если нет / не ваша.
   */
  public async deactivate(id: string, accountId: string): Promise<HabitFull> {
    const updated = await this._repository.update(id, accountId, { isActive: false });
    if (!updated) {
      throw new HabitNotFoundError('Привычка не найдена.');
    }
    return updated;
  }

  /**
   * @param value Сырое название.
   * @returns Обрезанное название.
   * @throws {ValidationError} Пусто или длиннее лимита.
   */
  private _validateTitle(value: string): string {
    const title = value.trim();
    if (title.length === 0) {
      throw new ValidationError('Название привычки обязательно.');
    }
    if (title.length > TITLE_MAX) {
      throw new ValidationError(`Название: не длиннее ${TITLE_MAX} символов.`);
    }
    return title;
  }

  /**
   * @param value Тип привычки.
   * @throws {ValidationError} Не из справочника.
   */
  private _validateKind(value: HabitKind): void {
    if (!HABIT_KINDS.includes(value)) {
      throw new ValidationError('Недопустимый тип привычки.');
    }
  }

  /**
   * Валидация RRULE-строки через `rrule` (парсится + содержит `FREQ`).
   * @param value RRULE-строка.
   * @throws {ValidationError} Невалидное правило.
   */
  private _validateRecurrence(value: string): void {
    if (!isValidRecurrence(value)) {
      throw new ValidationError('Расписание (RRULE) некорректно.');
    }
  }

  /**
   * Инварианты лесенки: целые `minTarget≥1`, `currentTarget≥minTarget`,
   * `goalTarget≥currentTarget` (если задан), `step>0` при `adaptive`, валидная policy.
   * @param ladder Лесенка.
   * @throws {ValidationError} При нарушении.
   */
  private _validateLadder(ladder: HabitLadder): void {
    if (!LADDER_POLICIES.includes(ladder.policy)) {
      throw new ValidationError('Недопустимая политика лесенки.');
    }
    if (!Number.isInteger(ladder.minTarget) || ladder.minTarget < 1) {
      throw new ValidationError('minTarget — целое ≥ 1.');
    }
    if (!Number.isInteger(ladder.currentTarget) || ladder.currentTarget < ladder.minTarget) {
      throw new ValidationError('currentTarget — целое ≥ minTarget.');
    }
    if (ladder.goalTarget !== null) {
      if (!Number.isInteger(ladder.goalTarget) || ladder.goalTarget < ladder.currentTarget) {
        throw new ValidationError('goalTarget — целое ≥ currentTarget.');
      }
    }
    if (ladder.policy === 'adaptive' && (!Number.isInteger(ladder.step ?? 0) || (ladder.step ?? 0) <= 0)) {
      throw new ValidationError('Для adaptive-лесенки step — целое > 0.');
    }
  }
}

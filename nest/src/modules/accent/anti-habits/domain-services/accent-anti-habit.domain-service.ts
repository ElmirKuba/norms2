import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCENT_ANTI_HABIT_REPOSITORY } from '../adapters/accent-anti-habit-repository.port';
import type {
  AccentAntiHabitRepositoryPort,
  AntiHabitUpdateData,
} from '../adapters/accent-anti-habit-repository.port';
import { ACCENT_ANTI_HABIT_EVENT_REPOSITORY } from '../adapters/accent-anti-habit-event-repository.port';
import type {
  AccentAntiHabitEventRepositoryPort,
  AntiHabitEventListOptions,
} from '../adapters/accent-anti-habit-event-repository.port';
import { ACCENT_ANTI_HABIT_EVENTS } from '../adapters/accent-anti-habit-events.port';
import type { AccentAntiHabitEventsPort } from '../adapters/accent-anti-habit-events.port';
import type { AntiHabitFull } from '../interfaces/anti-habit-full.interface';
import type { AntiHabitEventFull } from '../interfaces/anti-habit-event-full.interface';
import { AntiHabitNotFoundError } from '../../../../shared/errors/anti-habit-not-found.error';
import { AlreadyRelapsedError } from '../../../../shared/errors/already-relapsed.error';
import { InvalidStartDateError } from '../../../../shared/errors/invalid-start-date.error';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { reachedGoals } from './anti-habit-goal-ladder.util';
import type { Env } from '../../../../system/config/env.schema';

/** Число миллисекунд в сутках — для вычисления серии «сколько держусь». */
const DAY_MS = 86_400_000;
/** Максимум длины названия. */
const TITLE_MAX = 160;

/** Полных дней между двумя моментами (не отрицательно). */
function daysBetween(fromMs: number, toMs: number): number {
  return Math.floor(Math.max(0, toMs - fromMs) / DAY_MS);
}

/** Данные создания анти-привычки на уровне домена (без служебных полей попытки). */
export interface AntiHabitCreateInput {
  /** Владелец. */
  accountId: string;
  /** Название. */
  title: string;
  /** Описание (опц.). */
  description?: string | null;
  /** Цель серии в днях (опц.). */
  targetDays?: number | null;
  /** Плановый старт в БУДУЩЕМ (unix ms, опц.) — «Начать не сегодня» → состояние `planned`. */
  startAt?: number | null;
}

/** Данные обновления анти-привычки на уровне домена. */
export interface AntiHabitUpdateInput {
  title?: string | undefined;
  description?: string | null | undefined;
  targetDays?: number | null | undefined;
  isActive?: boolean | undefined;
}

/** Результат мутации попытки (рецидив/перенос): обновлённая анти-привычка + записанное событие. */
export interface AntiHabitMutationResult {
  /** Анти-привычка после мутации. */
  antiHabit: AntiHabitFull;
  /** Записанное событие таймлайна. */
  event: AntiHabitEventFull;
}

/**
 * Domain-service анти-привычек «держусь» (timer-модель, domain-model §7; ADR-0059). CRUD +
 * рецидив + перенос-в-будущее (`reschedule`) + плановый старт. Серия НЕ хранится (из
 * `currentAttemptStartedAt`); `recordDays` переживает срыв. История — единый таймлайн
 * `anti_habit_events`. **Мутации попытки — CAS-first (ADR-0035):** сначала атомарный сброс
 * попытки под `version`, при успехе — запись события (без «висячих» записей). Зависит только
 * от портов. Эмит `relapsed` — хук для 2.9 (очков не начисляет).
 */
@Injectable()
export class AccentAntiHabitDomainService {
  /**
   * @param _repository Порт анти-привычек.
   * @param _events Порт таймлайна событий (append-only).
   * @param _hooks Исходящий порт эмита событий (хуки для 2.9).
   * @param _configService Конфиг (число retry для CAS).
   */
  public constructor(
    @Inject(ACCENT_ANTI_HABIT_REPOSITORY)
    private readonly _repository: AccentAntiHabitRepositoryPort,
    @Inject(ACCENT_ANTI_HABIT_EVENT_REPOSITORY)
    private readonly _events: AccentAntiHabitEventRepositoryPort,
    @Inject(ACCENT_ANTI_HABIT_EVENTS)
    private readonly _hooks: AccentAntiHabitEventsPort,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Активные анти-привычки аккаунта.
   * @param accountId Идентификатор аккаунта.
   * @returns Список анти-привычек владельца.
   */
  public async list(accountId: string): Promise<AntiHabitFull[]> {
    return this._repository.listByAccount(accountId);
  }

  /**
   * Ручная сортировка анти-привычек (ADR-0054).
   * @param accountId Идентификатор аккаунта.
   * @param ids Желаемый порядок (сверху вниз).
   */
  public async reorder(accountId: string, ids: readonly string[]): Promise<void> {
    return this._repository.reorder(accountId, ids);
  }

  /**
   * Анти-привычка владельца или ошибка.
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Анти-привычка.
   * @throws {AntiHabitNotFoundError} Если нет / не ваша.
   */
  public async getOwned(id: string, accountId: string): Promise<AntiHabitFull> {
    const found = await this._repository.findOwned(id, accountId);
    if (!found) {
      throw new AntiHabitNotFoundError('Анти-привычка не найдена.');
    }
    return found;
  }

  /**
   * Создаёт анти-привычку. Без `startAt` — первая попытка стартует сейчас; с `startAt` в
   * будущем — плановый старт (`planned`) + событие `plan`.
   * @param data Данные создания.
   * @returns Созданная анти-привычка.
   * @throws {ValidationError} При нарушении инвариантов.
   * @throws {InvalidStartDateError} Если `startAt` не в будущем.
   */
  public async create(data: AntiHabitCreateInput): Promise<AntiHabitFull> {
    const title = this._validateTitle(data.title);
    const targetDays = this._validateTargetDays(data.targetDays ?? null);
    const now = Date.now();
    const startAt = data.startAt ?? null;
    const planned = startAt !== null;
    if (planned && startAt <= now) {
      throw new InvalidStartDateError('Плановый старт должен быть в будущем.');
    }
    const created = await this._repository.create({
      accountId: data.accountId,
      title,
      description: data.description ?? null,
      targetDays,
      currentAttemptStartedAt: planned ? startAt : now,
    });
    if (planned) {
      await this._events.insert({
        antiHabitId: created.id,
        type: 'plan',
        occurredAt: now,
        toStartedAt: startAt,
      });
    }
    return created;
  }

  /**
   * Обновляет анти-привычку владельца (частично). Дату старта НЕ меняет (перенос — `reschedule`).
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая анти-привычка.
   * @throws {ValidationError} При нарушении инвариантов.
   * @throws {AntiHabitNotFoundError} Если нет / не ваша.
   */
  public async update(
    id: string,
    accountId: string,
    patch: AntiHabitUpdateInput,
  ): Promise<AntiHabitFull> {
    const data: AntiHabitUpdateData = {};
    if (patch.title !== undefined) {
      data.title = this._validateTitle(patch.title);
    }
    if (patch.description !== undefined) {
      data.description = patch.description;
    }
    if (patch.targetDays !== undefined) {
      data.targetDays = this._validateTargetDays(patch.targetDays);
    }
    if (patch.isActive !== undefined) {
      data.isActive = patch.isActive;
    }
    const updated = await this._repository.update(id, accountId, data);
    if (!updated) {
      throw new AntiHabitNotFoundError('Анти-привычка не найдена.');
    }
    return updated;
  }

  /**
   * Фиксирует рецидив (срыв): сбрасывает таймер, инкрементит номер, обновляет рекорд и пишет
   * событие `relapse`. **CAS-first (ADR-0035):** сброс попытки атомарен по `version`;
   * конкурентный правочный `update` — перечитываем и повторяем; конкурентный `relapse` (сменил
   * номер попытки) / неактивная привычка → `ALREADY_RELAPSED`.
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param input Опц. триггер/заметка.
   * @returns Обновлённая анти-привычка + событие `relapse`.
   * @throws {AntiHabitNotFoundError} Если нет / не ваша.
   * @throws {AlreadyRelapsedError} Нет активной попытки / повторный срыв в тот же момент.
   */
  public async relapse(
    id: string,
    accountId: string,
    input: { triggerTag?: string | null; note?: string | null },
  ): Promise<AntiHabitMutationResult> {
    const attempts = this._configService.get('OPTIMISTIC_RETRY_ATTEMPTS', { infer: true });
    let current = await this.getOwned(id, accountId);
    if (!current.isActive) {
      throw new AlreadyRelapsedError('Нет активной попытки для срыва.');
    }
    const startedAttemptNumber = current.attemptNumber;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const now = Date.now();
      const durationMs = Math.max(0, now - current.currentAttemptStartedAt);
      const seriesDays = Math.floor(durationMs / DAY_MS);
      const beatsRecord = seriesDays > current.recordDays;

      const ok = await this._repository.setAttemptCas(id, accountId, current.version, {
        currentAttemptStartedAt: now,
        attemptNumber: current.attemptNumber + 1,
        recordDays: beatsRecord ? seriesDays : current.recordDays,
        recordAttemptStartedAt: beatsRecord
          ? current.currentAttemptStartedAt
          : current.recordAttemptStartedAt,
      });

      if (ok) {
        const event = await this._events.insert({
          antiHabitId: id,
          type: 'relapse',
          occurredAt: now,
          attemptDurationMs: durationMs,
          endedAttemptNumber: current.attemptNumber,
          triggerTag: input.triggerTag ?? null,
          note: input.note ?? null,
        });
        this._hooks.relapsed({
          antiHabitId: id,
          accountId,
          relapseAt: now,
          endedAttemptDurationMs: durationMs,
          endedAttemptNumber: current.attemptNumber,
        });
        return { antiHabit: this._applyAttempt(current, now, beatsRecord, seriesDays), event };
      }

      const reread = await this._repository.findOwned(id, accountId);
      if (!reread || !reread.isActive) {
        throw new AlreadyRelapsedError('Нет активной попытки для срыва.');
      }
      if (reread.attemptNumber !== startedAttemptNumber) {
        throw new AlreadyRelapsedError('Срыв уже зафиксирован только что.');
      }
      current = reread;
    }
    throw new AlreadyRelapsedError('Не удалось зафиксировать срыв, попробуйте ещё раз.');
  }

  /**
   * Переносит старт попытки в БУДУЩЕЕ (ADR-0059): завершает текущую попытку (учитывая рекорд),
   * ставит `currentAttemptStartedAt=startAt` (→ `planned`), пишет событие `reschedule` с
   * `heldDays`. CAS-first по `version` (как рецидив). Бэкфилл в прошлое запрещён.
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param startAt Новый старт (unix ms, строго в будущем).
   * @returns Обновлённая анти-привычка + событие `reschedule`.
   * @throws {AntiHabitNotFoundError} Если нет / не ваша.
   * @throws {InvalidStartDateError} Если `startAt` не в будущем.
   * @throws {ValidationError} Неактивна / конкурентная правка не разрешилась.
   */
  public async reschedule(
    id: string,
    accountId: string,
    startAt: number,
  ): Promise<AntiHabitMutationResult> {
    const attempts = this._configService.get('OPTIMISTIC_RETRY_ATTEMPTS', { infer: true });
    let current = await this.getOwned(id, accountId);
    if (!current.isActive) {
      throw new ValidationError('Анти-привычка неактивна.');
    }
    const startedAttemptNumber = current.attemptNumber;

    for (let attempt = 0; attempt < attempts; attempt++) {
      const now = Date.now();
      if (startAt <= now) {
        throw new InvalidStartDateError('Новый старт должен быть в будущем.');
      }
      const fromStartedAt = current.currentAttemptStartedAt;
      const heldDays = daysBetween(fromStartedAt, now); // planned (старт в будущем) → 0
      const beatsRecord = heldDays > current.recordDays;

      const ok = await this._repository.setAttemptCas(id, accountId, current.version, {
        currentAttemptStartedAt: startAt,
        attemptNumber: current.attemptNumber + 1,
        recordDays: beatsRecord ? heldDays : current.recordDays,
        recordAttemptStartedAt: beatsRecord ? fromStartedAt : current.recordAttemptStartedAt,
      });

      if (ok) {
        const event = await this._events.insert({
          antiHabitId: id,
          type: 'reschedule',
          occurredAt: now,
          fromStartedAt,
          toStartedAt: startAt,
          heldDays,
        });
        return {
          antiHabit: {
            ...current,
            currentAttemptStartedAt: startAt,
            attemptNumber: current.attemptNumber + 1,
            recordDays: beatsRecord ? heldDays : current.recordDays,
            recordAttemptStartedAt: beatsRecord ? fromStartedAt : current.recordAttemptStartedAt,
            version: current.version + 1,
          },
          event,
        };
      }

      const reread = await this._repository.findOwned(id, accountId);
      if (!reread || !reread.isActive) {
        throw new ValidationError('Анти-привычка неактивна.');
      }
      if (reread.attemptNumber !== startedAttemptNumber) {
        throw new ValidationError('Состояние изменилось только что, повторите.');
      }
      current = reread;
    }
    throw new ValidationError('Не удалось перенести, попробуйте ещё раз.');
  }

  /**
   * История событий анти-привычки (с проверкой владения через родителя).
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param opts limit + опц. курсор.
   * @returns Страница событий.
   * @throws {AntiHabitNotFoundError} Если нет / не ваша.
   */
  public async listEvents(
    id: string,
    accountId: string,
    opts: AntiHabitEventListOptions,
  ): Promise<AntiHabitEventFull[]> {
    const owned = await this.getOwned(id, accountId);
    // На первой странице (курсор пуст) — материализуем достигнутые пороги авто-цели, чтобы
    // «цель N достигнута» появилась в ленте (ADR-0060). На последующих страницах не трогаем.
    if (!opts.cursor) {
      await this._materializeReachedGoals(owned);
    }
    return this._events.listEvents(id, opts);
  }

  /**
   * Идемпотентно дописывает события `goal_reached` для порогов авто-цели, достигнутых к `now` в
   * рамках ТЕКУЩЕЙ попытки (ADR-0060). `since` = максимальный уже отмеченный порог этой попытки
   * (события прошлых попыток произошли до её старта → не учитываются); `reachedGoals` возвращает
   * только ступени `thresholdDays > since`, поэтому повторный вызов ничего не дублирует.
   * @param antiHabit Анти-привычка владельца (уже проверена).
   */
  private async _materializeReachedGoals(antiHabit: AntiHabitFull): Promise<void> {
    const now = Date.now();
    const startedAt = antiHabit.currentAttemptStartedAt;
    const since = await this._events.latestGoalReachedThreshold(antiHabit.id, startedAt);
    const goals = reachedGoals(startedAt, now, antiHabit.targetDays, since);
    for (const goal of goals) {
      await this._events.insert({
        antiHabitId: antiHabit.id,
        type: 'goal_reached',
        occurredAt: goal.targetDate,
        thresholdLabel: goal.label,
        thresholdDays: goal.thresholdDays,
      });
    }
  }

  /**
   * Собирает обновлённую анти-привычку после сброса попытки (для проекции без перечитывания).
   * @param current Прежнее состояние.
   * @param startedAt Новый старт.
   * @param beatsRecord Побит ли рекорд.
   * @param seriesDays Серия завершившейся попытки.
   * @returns Новое состояние.
   */
  private _applyAttempt(
    current: AntiHabitFull,
    startedAt: number,
    beatsRecord: boolean,
    seriesDays: number,
  ): AntiHabitFull {
    return {
      ...current,
      currentAttemptStartedAt: startedAt,
      attemptNumber: current.attemptNumber + 1,
      recordDays: beatsRecord ? seriesDays : current.recordDays,
      recordAttemptStartedAt: beatsRecord ? current.currentAttemptStartedAt : current.recordAttemptStartedAt,
      version: current.version + 1,
    };
  }

  /**
   * Валидирует и нормализует название.
   * @param value Сырое значение.
   * @returns Обрезанное название.
   * @throws {ValidationError} Пусто или длиннее лимита.
   */
  private _validateTitle(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Название анти-привычки обязательно.');
    }
    if (trimmed.length > TITLE_MAX) {
      throw new ValidationError(`Название: не длиннее ${TITLE_MAX} символов.`);
    }
    return trimmed;
  }

  /**
   * Валидирует цель серии в днях.
   * @param value Значение или null.
   * @returns Валидное значение или null.
   * @throws {ValidationError} Не целое / не положительное.
   */
  private _validateTargetDays(value: number | null): number | null {
    if (value === null) {
      return null;
    }
    if (!Number.isInteger(value) || value <= 0) {
      throw new ValidationError('Цель в днях — целое число больше нуля.');
    }
    return value;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ACCENT_ANTI_HABIT_REPOSITORY,
} from '../adapters/accent-anti-habit-repository.port';
import type {
  AccentAntiHabitRepositoryPort,
  AntiHabitUpdateData,
} from '../adapters/accent-anti-habit-repository.port';
import {
  ACCENT_ANTI_HABIT_RELAPSE_REPOSITORY,
} from '../adapters/accent-anti-habit-relapse-repository.port';
import type {
  AccentAntiHabitRelapseRepositoryPort,
  AntiHabitRelapseListOptions,
} from '../adapters/accent-anti-habit-relapse-repository.port';
import { ACCENT_ANTI_HABIT_EVENTS } from '../adapters/accent-anti-habit-events.port';
import type { AccentAntiHabitEventsPort } from '../adapters/accent-anti-habit-events.port';
import type { AntiHabitFull } from '../interfaces/anti-habit-full.interface';
import type { AntiHabitRelapseFull } from '../interfaces/anti-habit-relapse-full.interface';
import { AntiHabitNotFoundError } from '../../../../shared/errors/anti-habit-not-found.error';
import { AlreadyRelapsedError } from '../../../../shared/errors/already-relapsed.error';
import { ValidationError } from '../../../../shared/errors/validation.error';
import type { Env } from '../../../../system/config/env.schema';

/** Число миллисекунд в сутках — для вычисления серии «сколько держусь». */
const DAY_MS = 86_400_000;
/** Максимум длины названия. */
const TITLE_MAX = 160;

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
}

/** Данные обновления анти-привычки на уровне домена. */
export interface AntiHabitUpdateInput {
  title?: string | undefined;
  description?: string | null | undefined;
  targetDays?: number | null | undefined;
  isActive?: boolean | undefined;
}

/** Результат рецидива: обновлённая анти-привычка (после сброса) + записанная попытка. */
export interface RelapseResult {
  /** Анти-привычка после сброса таймера/обновления рекорда. */
  antiHabit: AntiHabitFull;
  /** Записанный рецидив. */
  relapse: AntiHabitRelapseFull;
}

/**
 * Domain-service анти-привычек «держусь» (timer-модель, domain-model §7). CRUD + рецидив.
 * Серия НЕ хранится (вычисляется из `currentAttemptStartedAt`); `recordDays` переживает
 * срыв. **Рецидив — CAS-first (ADR-0035):** сначала атомарный сброс попытки под `version`,
 * и только при успехе — запись рецидива в журнал (иначе конкурентный срыв уже сбросил
 * таймер → `ALREADY_RELAPSED`, без «висячего» рецидива). Зависит только от портов.
 * События (`relapsed`) — хук для 2.9 (очков не начисляет).
 */
@Injectable()
export class AccentAntiHabitDomainService {
  /**
   * @param _repository Порт анти-привычек.
   * @param _relapses Порт журнала рецидивов.
   * @param _events Исходящий порт событий (хуки для 2.9).
   * @param _configService Конфиг (число retry для CAS).
   */
  public constructor(
    @Inject(ACCENT_ANTI_HABIT_REPOSITORY)
    private readonly _repository: AccentAntiHabitRepositoryPort,
    @Inject(ACCENT_ANTI_HABIT_RELAPSE_REPOSITORY)
    private readonly _relapses: AccentAntiHabitRelapseRepositoryPort,
    @Inject(ACCENT_ANTI_HABIT_EVENTS)
    private readonly _events: AccentAntiHabitEventsPort,
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
   * Создаёт анти-привычку (первая попытка стартует сейчас).
   * @param data Данные создания.
   * @returns Созданная анти-привычка.
   * @throws {ValidationError} При нарушении инвариантов.
   */
  public async create(data: AntiHabitCreateInput): Promise<AntiHabitFull> {
    const title = this._validateTitle(data.title);
    const targetDays = this._validateTargetDays(data.targetDays ?? null);
    return this._repository.create({
      accountId: data.accountId,
      title,
      description: data.description ?? null,
      targetDays,
      currentAttemptStartedAt: Date.now(),
    });
  }

  /**
   * Обновляет анти-привычку владельца (частично).
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
   * Фиксирует рецидив (срыв): сбрасывает таймер текущей попытки, инкрементит номер, обновляет
   * рекорд при необходимости и пишет запись в журнал. **CAS-first (ADR-0035):** сброс попытки
   * атомарен по `version`; конкурентный правочный `update` (сменил version, но не номер
   * попытки) — перечитываем и повторяем; конкурентный `relapse` (сменил номер попытки) или
   * неактивная привычка → `ALREADY_RELAPSED`.
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param input Опц. триггер/заметка.
   * @returns Обновлённая анти-привычка + записанный рецидив.
   * @throws {AntiHabitNotFoundError} Если нет / не ваша.
   * @throws {AlreadyRelapsedError} Нет активной попытки / повторный срыв в тот же момент.
   */
  public async relapse(
    id: string,
    accountId: string,
    input: { triggerTag?: string | null; note?: string | null },
  ): Promise<RelapseResult> {
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
        const relapse = await this._relapses.insert({
          antiHabitId: id,
          relapseAt: now,
          attemptDurationMs: durationMs,
          triggerTag: input.triggerTag ?? null,
          note: input.note ?? null,
        });
        this._events.relapsed({
          antiHabitId: id,
          accountId,
          relapseAt: now,
          endedAttemptDurationMs: durationMs,
          endedAttemptNumber: current.attemptNumber,
        });
        const updated: AntiHabitFull = {
          ...current,
          currentAttemptStartedAt: now,
          attemptNumber: current.attemptNumber + 1,
          recordDays: beatsRecord ? seriesDays : current.recordDays,
          recordAttemptStartedAt: beatsRecord
            ? current.currentAttemptStartedAt
            : current.recordAttemptStartedAt,
          version: current.version + 1,
        };
        return { antiHabit: updated, relapse };
      }

      // CAS не прошёл — кто-то поменял строку. Перечитываем, чтобы понять причину.
      const reread = await this._repository.findOwned(id, accountId);
      if (!reread || !reread.isActive) {
        throw new AlreadyRelapsedError('Нет активной попытки для срыва.');
      }
      if (reread.attemptNumber !== startedAttemptNumber) {
        // Номер попытки изменился → конкурентный срыв уже сбросил таймер. Дубль не пишем.
        throw new AlreadyRelapsedError('Срыв уже зафиксирован только что.');
      }
      // Номер тот же (был правочный update, сменивший version) — повторяем с новой version.
      current = reread;
    }

    // Не разрешилось за N попыток (частые конкурентные правки) — не рискуем дублем.
    throw new AlreadyRelapsedError('Не удалось зафиксировать срыв, попробуйте ещё раз.');
  }

  /**
   * История рецидивов анти-привычки (с проверкой владения через родителя).
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param opts limit + опц. курсор.
   * @returns Страница рецидивов.
   * @throws {AntiHabitNotFoundError} Если нет / не ваша.
   */
  public async listRelapses(
    id: string,
    accountId: string,
    opts: AntiHabitRelapseListOptions,
  ): Promise<AntiHabitRelapseFull[]> {
    await this.getOwned(id, accountId);
    return this._relapses.listRelapses(id, opts);
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

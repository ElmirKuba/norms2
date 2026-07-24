import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { antiHabitEvents } from '../../schemas/anti-habit-events.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentAntiHabitEventRepositoryPort,
  AntiHabitEventCreateData,
  AntiHabitEventListOptions,
} from '../../../modules/accent/anti-habits/adapters/accent-anti-habit-event-repository.port';
import type { AntiHabitEventFull } from '../../../modules/accent/anti-habits/interfaces/anti-habit-event-full.interface';

/**
 * Drizzle-реализация порта событий «держусь» (единственное место с ORM, ADR-0059). Строка
 * `anti_habit_events` совпадает с `AntiHabitEventFull` (колонки 1:1). Append-only: insert +
 * keyset-листинг. Биндится на `ACCENT_ANTI_HABIT_EVENT_REPOSITORY`.
 */
@Injectable()
export class AccentAntiHabitEventRepository implements AccentAntiHabitEventRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Добавляет событие (id — `generateId()`; поля не для типа = null).
   * @param data Данные события.
   * @returns Созданная запись.
   * @throws {Error} Если insert не вернул строку.
   */
  public async insert(data: AntiHabitEventCreateData): Promise<AntiHabitEventFull> {
    const rows = await this._db
      .insert(antiHabitEvents)
      .values({
        id: generateId(),
        antiHabitId: data.antiHabitId,
        type: data.type,
        occurredAt: data.occurredAt,
        attemptDurationMs: data.attemptDurationMs ?? null,
        endedAttemptNumber: data.endedAttemptNumber ?? null,
        triggerTag: data.triggerTag ?? null,
        note: data.note ?? null,
        fromStartedAt: data.fromStartedAt ?? null,
        toStartedAt: data.toStartedAt ?? null,
        heldDays: data.heldDays ?? null,
        thresholdLabel: data.thresholdLabel ?? null,
        thresholdDays: data.thresholdDays ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('anti_habit_events: insert не вернул строку.');
    }
    return row;
  }

  /**
   * История событий (новые→старые), keyset-пагинация по (occurred_at desc, id desc).
   * @param antiHabitId Идентификатор анти-привычки.
   * @param opts limit + опц. курсор.
   * @returns Страница событий (не более `limit`).
   */
  public async listEvents(
    antiHabitId: string,
    opts: AntiHabitEventListOptions,
  ): Promise<AntiHabitEventFull[]> {
    const cursor = opts.cursor;
    const where = cursor
      ? and(
          eq(antiHabitEvents.antiHabitId, antiHabitId),
          or(
            lt(antiHabitEvents.occurredAt, cursor.occurredAt),
            and(
              eq(antiHabitEvents.occurredAt, cursor.occurredAt),
              lt(antiHabitEvents.id, cursor.id),
            ),
          ),
        )
      : eq(antiHabitEvents.antiHabitId, antiHabitId);
    return this._db
      .select()
      .from(antiHabitEvents)
      .where(where)
      .orderBy(desc(antiHabitEvents.occurredAt), desc(antiHabitEvents.id))
      .limit(opts.limit);
  }
}

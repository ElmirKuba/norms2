import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lt, max, or } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { antiHabitEvents } from '../../schemas/anti-habit-events.schema';
import { antiHabits } from '../../schemas/anti-habits.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentAntiHabitEventRepositoryPort,
  AntiHabitEventCreateData,
  AntiHabitEventListOptions,
  ReachedMilestoneRow,
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
        obstacleId: data.obstacleId ?? null,
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

  /**
   * Максимальный `thresholdDays` среди `goal_reached`-событий с `occurredAt >= sinceOccurredAt`
   * (ADR-0060; для идемпотентной материализации авто-цели в рамках текущей попытки).
   * @param antiHabitId Идентификатор анти-привычки.
   * @param sinceOccurredAt Нижняя граница `occurredAt` (unix ms).
   * @returns Наибольший отмеченный порог (дней) или 0, если отметок нет.
   */
  public async latestGoalReachedThreshold(
    antiHabitId: string,
    sinceOccurredAt: number,
  ): Promise<number> {
    const rows = await this._db
      .select({ maxThreshold: max(antiHabitEvents.thresholdDays) })
      .from(antiHabitEvents)
      .where(
        and(
          eq(antiHabitEvents.antiHabitId, antiHabitId),
          eq(antiHabitEvents.type, 'goal_reached'),
          gte(antiHabitEvents.occurredAt, sinceOccurredAt),
        ),
      );
    return rows[0]?.maxThreshold ?? 0;
  }

  /**
   * Самая свежая веха аккаунта по всем анти-привычкам (join с `anti_habits` ради названия и
   * владельца). При совпадении момента побеждает старший порог: догнав 3 и 7 дней одним
   * заходом, человек должен увидеть «неделю», а не «три дня».
   * @param accountId Владелец.
   * @param sinceOccurredAt Нижняя граница `occurredAt` (unix ms).
   * @returns Веха или null.
   */
  public async latestGoalReachedForAccount(
    accountId: string,
    sinceOccurredAt: number,
  ): Promise<ReachedMilestoneRow | null> {
    const rows = await this._db
      .select({
        antiHabitId: antiHabitEvents.antiHabitId,
        title: antiHabits.title,
        label: antiHabitEvents.thresholdLabel,
        thresholdDays: antiHabitEvents.thresholdDays,
        occurredAt: antiHabitEvents.occurredAt,
      })
      .from(antiHabitEvents)
      .innerJoin(antiHabits, eq(antiHabits.id, antiHabitEvents.antiHabitId))
      .where(
        and(
          eq(antiHabits.accountId, accountId),
          eq(antiHabitEvents.type, 'goal_reached'),
          gte(antiHabitEvents.occurredAt, sinceOccurredAt),
        ),
      )
      .orderBy(desc(antiHabitEvents.occurredAt), desc(antiHabitEvents.thresholdDays))
      .limit(1);
    const row = rows[0];
    if (row === undefined || row.label === null || row.thresholdDays === null) {
      return null;
    }
    return {
      antiHabitId: row.antiHabitId,
      title: row.title,
      label: row.label,
      thresholdDays: row.thresholdDays,
      occurredAt: row.occurredAt,
    };
  }
}

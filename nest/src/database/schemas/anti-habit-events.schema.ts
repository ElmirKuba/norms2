import { bigint, index, integer, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { antiHabits } from './anti-habits.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  AntiHabitEventFull,
  AntiHabitEventType,
} from '../../modules/accent/anti-habits/interfaces/anti-habit-event-full.interface';

/**
 * anti_habit_events — таймлайн событий «держусь» (append-only; колонки 1:1 с AntiHabitEventFull,
 * ADR-0059). Единая лента: `type` (relapse|reschedule|plan|goal_reached) + общие поля +
 * типо-специфичные nullable-колонки (явно, без jsonb). `anti_habit_id` → `anti_habits` ON DELETE
 * CASCADE. Времена — unix ms/`bigint`. Индекс `(anti_habit_id, occurred_at)` — keyset-история.
 * Заменяет relapse-only `anti_habit_relapses` (миграция перевода — до первого деплоя фичи).
 */
export const antiHabitEvents = defineTableWithSchema<AntiHabitEventFull>()(
  'anti_habit_events',
  {
    id: idColumn(),
    antiHabitId: fkColumn('anti_habit_id')
      .notNull()
      .references(() => antiHabits.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 16 }).$type<AntiHabitEventType>().notNull(),
    occurredAt: bigint('occurred_at', { mode: 'number' }).notNull(),
    // relapse
    attemptDurationMs: bigint('attempt_duration_ms', { mode: 'number' }),
    endedAttemptNumber: integer('ended_attempt_number'),
    triggerTag: varchar('trigger_tag', { length: 120 }),
    note: text('note'),
    // reschedule / plan
    fromStartedAt: bigint('from_started_at', { mode: 'number' }),
    toStartedAt: bigint('to_started_at', { mode: 'number' }),
    heldDays: integer('held_days'),
    // goal_reached
    thresholdLabel: varchar('threshold_label', { length: 32 }),
    thresholdDays: integer('threshold_days'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('anti_habit_events_habit_at_idx').on(table.antiHabitId, table.occurredAt),
  ],
);

import { bigint, index, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { antiHabits } from './anti-habits.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AntiHabitRelapseFull } from '../../modules/accent/anti-habits/interfaces/anti-habit-relapse-full.interface';

/**
 * anti_habit_relapses — журнал срывов анти-привычек (append-only; колонки 1:1 с
 * AntiHabitRelapseFull, domain-model §7). `anti_habit_id` → `anti_habits` ON DELETE
 * CASCADE. `relapse_at`/`attempt_duration_ms` — unix ms/`bigint`. `trigger_tag`/`note` —
 * свободные поля (подсказка «без ПДн», ui-ux §9). Только `created_at` (иммутабельны).
 * Индекс `(anti_habit_id, relapse_at)` — под keyset-историю (новые→старые, C4.7).
 */
export const antiHabitRelapses = defineTableWithSchema<AntiHabitRelapseFull>()(
  'anti_habit_relapses',
  {
    id: idColumn(),
    antiHabitId: fkColumn('anti_habit_id')
      .notNull()
      .references(() => antiHabits.id, { onDelete: 'cascade' }),
    relapseAt: bigint('relapse_at', { mode: 'number' }).notNull(),
    attemptDurationMs: bigint('attempt_duration_ms', { mode: 'number' }).notNull(),
    triggerTag: varchar('trigger_tag', { length: 120 }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('anti_habit_relapses_habit_at_idx').on(table.antiHabitId, table.relapseAt),
  ],
);

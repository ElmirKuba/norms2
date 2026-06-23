import { date, doublePrecision, index, text, timestamp } from 'drizzle-orm/pg-core';
import { goals } from './goals.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { GoalEntryFull } from '../../modules/accent/goals/interfaces/goal-entry-full.interface';

/**
 * goal_entries — записи прогресса целей (append-only; колонки 1:1 с GoalEntryFull,
 * ADR-0052). `value` — `doublePrecision` (инкремент для accumulate / замер для reach/
 * reduce); **без DB-CHECK** на знак/ноль (семантика рода — в домене 2.5·8: для accumulate
 * value≠0, для reach/reduce любой замер). `goal_id` → `goals` cascade. Только `created_at`
 * (иммутабельны). Индекс `(goal_id, occurred_on)` — под агрегаты (Σ / последний / первый)
 * и историю. Владение — через родительскую цель (проверяет домен).
 */
export const goalEntries = defineTableWithSchema<GoalEntryFull>()(
  'goal_entries',
  {
    id: idColumn(),
    goalId: fkColumn('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    value: doublePrecision('value').notNull(),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    note: text('note'),
    // Источник-задача (привычка→цель, 2.5·13) для отката при uncomplete; мягкая ссылка без FK.
    sourceTaskId: fkColumn('source_task_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('goal_entries_goal_occurred_idx').on(table.goalId, table.occurredOn)],
);

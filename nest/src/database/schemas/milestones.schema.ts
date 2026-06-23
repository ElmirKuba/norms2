import { doublePrecision, index, text, timestamp } from 'drizzle-orm/pg-core';
import { goals } from './goals.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { MilestoneFull } from '../../modules/accent/goals/interfaces/milestone-full.interface';

/**
 * milestones — вехи целей (колонки 1:1 с MilestoneFull, ADR-0052). **Без `reached_at`** —
 * достигнутость вычисляется на чтение (`currentValue ≥ threshold_value`, ·11). `goal_id` →
 * `goals` cascade. Только `created_at` (вехи неизменны). Индекс по `goal_id` (список вехи
 * цели). Инвариант `threshold ≤ targetValue` — в домене. Владение — через родительскую цель.
 */
export const milestones = defineTableWithSchema<MilestoneFull>()(
  'milestones',
  {
    id: idColumn(),
    goalId: fkColumn('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    thresholdValue: doublePrecision('threshold_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('milestones_goal_idx').on(table.goalId)],
);

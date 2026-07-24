import { bigint, boolean, check, integer, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AntiHabitFull } from '../../modules/accent/anti-habits/interfaces/anti-habit-full.interface';

/**
 * anti_habits — «держусь» (воздержание, timer-модель; per-account; колонки 1:1 с
 * AntiHabitFull, domain-model §7). Серия НЕ хранится — вычисляется из
 * `current_attempt_started_at` (unix ms → `bigint`). `record_days` хранится отдельно и
 * **переживает срыв**. `version` — оптимистичный лок: рецидив пишется через CAS (ADR-0035),
 * гонка двух срывов разрешается. CHECK'и (attempt≥1, record≥0, target>0) — защита-в-глубину;
 * дружелюбная валидация — на domain-service (C3). Времена в мс (не timestamp): их шлём на
 * фронт для живого счёта серии и делаем над ними арифметику.
 */
export const antiHabits = defineTableWithSchema<AntiHabitFull>()(
  'anti_habits',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    currentAttemptStartedAt: bigint('current_attempt_started_at', { mode: 'number' }).notNull(),
    attemptNumber: integer('attempt_number').notNull().default(1),
    recordDays: integer('record_days').notNull().default(0),
    recordAttemptStartedAt: bigint('record_attempt_started_at', { mode: 'number' }),
    targetDays: integer('target_days'),
    // Ручной порядок (ADR-0054, drag-to-reorder): per-account; новый — в конец (max+1).
    position: integer('position').notNull().default(0),
    // Оптимистичный лок (ADR-0035): рецидив пишет через CAS по version; любой update bump'ает.
    version: integer('version').notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    check('anti_habits_attempt_number_min', sql`${table.attemptNumber} >= 1`),
    check('anti_habits_record_days_min', sql`${table.recordDays} >= 0`),
    check(
      'anti_habits_target_days_positive',
      sql`${table.targetDays} IS NULL OR ${table.targetDays} > 0`,
    ),
  ],
);

import {
  boolean,
  date,
  doublePrecision,
  jsonb,
  text,
  timestamp,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  GoalDirection,
  GoalFull,
  GoalPausePeriod,
  GoalStatus,
} from '../../modules/accent/goals/interfaces/goal-full.interface';

/**
 * goals — цели (per-account; колонки 1:1 с GoalFull, ADR-0052). **Без `version`** —
 * агрегаты (`currentValue/%/forecast/rollup`) вычисляются на чтение из `goal_entries`/
 * подцелей, счётчиков не храним → гонок нет. `direction` — род цели (accumulate/reach/
 * reduce). `targetValue`/`startValue` — `doublePrecision` (JS number, дробные замеры).
 * `parent_goal_id` — self-FK (подцель; глубину сторожит домен из `ACCENT_GOAL_MAX_DEPTH`).
 * `attributes` — jsonb string[] (ключи RPG-атрибутов); `pause_history` — jsonb периодов
 * пауз для `activeDays`. Инварианты значения (accumulate `target>0`; reach/reduce
 * `target≠start`) — в домене 2.5·4; **без DB-CHECK** `target<>0` — он рубил легитимные
 * reduce-цели с `target=0` («бросить курить = 0»). `domain_key` — мягкий ключ сферы (без FK).
 */
export const goals = defineTableWithSchema<GoalFull>()(
  'goals',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    // self-FK на родительскую цель: удаление родителя каскадит подцели.
    parentGoalId: fkColumn('parent_goal_id').references(
      (): AnyPgColumn => goals.id,
      { onDelete: 'cascade' },
    ),
    title: text('title').notNull(),
    whyItMatters: text('why_it_matters'),
    domainKey: varchar('domain_key', { length: 64 }),
    attributes: jsonb('attributes').$type<string[]>().notNull().default([]),
    direction: varchar('direction', { length: 16 }).$type<GoalDirection>().notNull(),
    unit: varchar('unit', { length: 32 }).notNull(),
    targetValue: doublePrecision('target_value').notNull(),
    startValue: doublePrecision('start_value'),
    deadline: date('deadline', { mode: 'string' }),
    status: varchar('status', { length: 16 })
      .$type<GoalStatus>()
      .notNull()
      .default('active'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    fallbackVersion: text('fallback_version'),
    isStarter: boolean('is_starter').notNull().default(false),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    pauseHistory: jsonb('pause_history')
      .$type<GoalPausePeriod[]>()
      .notNull()
      .default([]),
    ...timestamps(),
  },
);

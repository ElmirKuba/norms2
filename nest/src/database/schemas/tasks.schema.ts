import { date, integer, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { habits } from './habits.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  TaskSkipReason,
  TaskStatus,
} from '../../modules/accent/habits/interfaces/task-full.interface';
import type { HabitKind } from '../../modules/accent/habits/interfaces/habit-full.interface';
import type { TaskFull } from '../../modules/accent/habits/interfaces/task-full.interface';

/**
 * tasks — задачи дня (инстансы привычек + разовые; колонки 1:1 с TaskFull). Иммутабельны
 * по `created_at` (но статус/doneValue/completedAt меняются на месте). `template_id` →
 * `habits` (cascade; null = разовая); **уник `(template_id, occurred_on)`** = 1 инстанс
 * привычки на день (NULL-шаблоны не конфликтуют → разовых на день сколько угодно).
 * `goal_id`/`postponed_from_task_id` — мягкие ссылки без FK (goals — 2.5; self-ref — проще).
 */
export const tasks = defineTableWithSchema<TaskFull>()(
  'tasks',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    templateId: fkColumn('template_id').references(() => habits.id, { onDelete: 'cascade' }),
    goalId: fkColumn('goal_id'),
    title: text('title').notNull(),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    kind: varchar('kind', { length: 16 }).$type<HabitKind>().notNull(),
    targetValue: integer('target_value'),
    doneValue: integer('done_value'),
    status: varchar('status', { length: 16 }).$type<TaskStatus>().notNull().default('pending'),
    skipReason: varchar('skip_reason', { length: 16 }).$type<TaskSkipReason>(),
    postponedFromTaskId: fkColumn('postponed_from_task_id'),
    priority: integer('priority').notNull().default(0),
    category: varchar('category', { length: 32 }),
    deadline: timestamp('deadline', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tasks_template_day_unique').on(table.templateId, table.occurredOn),
  ],
);

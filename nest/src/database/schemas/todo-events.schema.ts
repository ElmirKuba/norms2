import { date, index, timestamp, text } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { TodoEventFull } from '../../modules/accent/todos/interfaces/todo-event-full.interface';

/**
 * todo_events — справочник событий, которых ждут дела (per-account; колонки 1:1 с
 * `TodoEventFull`).
 *
 * Одно событие держит несколько дел («приедет сварщик 27.08» — и перенос батареи, и переварка
 * труб, и покупка кронштейна), поэтому это справочник, а не строка внутри записи: перенос даты
 * правится в одном месте, а не в трёх, которые разошлись бы молча.
 */
export const todoEvents = defineTableWithSchema<TodoEventFull>()(
  'todo_events',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id),
    title: text('title').notNull(),
    expectedOn: date('expected_on', { mode: 'string' }),
    happenedAt: timestamp('happened_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [index('todo_events_account_idx').on(table.accountId)],
);

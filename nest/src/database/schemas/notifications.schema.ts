import { sql } from 'drizzle-orm';
import { check, index, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { NotificationFull } from '../../modules/notifications/interfaces/notification-full.interface';
import type { NotificationKind } from '../../modules/notifications/interfaces/notification-pure.interface';

/**
 * notifications — уведомления (колонки 1:1 с NotificationFull). `account_id` NULL =
 * broadcast всем, set = персональное. Контент: ИЛИ `body` (inline), ИЛИ
 * `content_file` (путь к .md относительно content/, раздаётся бэком). `key` —
 * стабильный ключ идемпотентного сида релизов (NULL у персональных; NULL'ы в
 * unique различны → можно много). «Прочитано» — наличие строки в notification_reads.
 */
export const notifications = defineTableWithSchema<NotificationFull>()(
  'notifications',
  {
    id: idColumn(),
    kind: varchar('kind', { length: 16 }).$type<NotificationKind>().notNull(),
    accountId: fkColumn('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    contentFile: varchar('content_file', { length: 255 }),
    key: varchar('key', { length: 128 }),
    ...timestamps(),
  },
  (table) => [
    index('notifications_account_id_idx').on(table.accountId),
    index('notifications_created_at_idx').on(table.createdAt),
    uniqueIndex('notifications_key_unique').on(table.key),
    check('notifications_kind_check', sql`${table.kind} in ('release', 'system', 'personal')`),
  ],
);

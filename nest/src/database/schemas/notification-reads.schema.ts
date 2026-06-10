import { uniqueIndex } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { notifications } from './notifications.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { NotificationReadFull } from '../../modules/notifications/interfaces/notification-read-full.interface';

/**
 * notification_reads — отметки «прочитано» (колонки 1:1 с NotificationReadFull).
 * Наличие строки = уведомление прочитано пользователем; непрочитанные = адресованные
 * мне `notifications` без моей строки здесь. Одна отметка на пару — partial unique.
 */
export const notificationReads = defineTableWithSchema<NotificationReadFull>()(
  'notification_reads',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    notificationId: fkColumn('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('notification_reads_account_notification_unique').on(
      table.accountId,
      table.notificationId,
    ),
  ],
);

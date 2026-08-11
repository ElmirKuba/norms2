import { sql } from 'drizzle-orm';
import { check, index, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { releases } from './releases.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { NotificationFull } from '../../modules/notifications/interfaces/notification-full.interface';
import type {
  NotificationContentFormat,
  NotificationKind,
} from '../../modules/notifications/interfaces/notification-pure.interface';

/**
 * notifications — уведомления (колонки 1:1 с NotificationFull). `account_id` NULL =
 * broadcast всем, set = персональное. Контент: ИЛИ `body` (inline), ИЛИ
 * `content_file` (путь к .md относительно content/, раздаётся бэком). `key` —
 * стабильный ключ идемпотентного сида релизов (NULL у персональных; NULL'ы в
 * unique различны → можно много). «Прочитано» — наличие строки в notification_reads. `broadcasted_at` — отметка о
 * публикации во внешний канал (Telegram, 2.9.1): сидер идёт при каждом старте, и без неё канал
 * получал бы все релизы заново на каждый деплой.
 */
export const notifications = defineTableWithSchema<NotificationFull>()(
  'notifications',
  {
    id: idColumn(),
    kind: varchar('kind', { length: 16 }).$type<NotificationKind>().notNull(),
    accountId: fkColumn('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body'),
    // Ссылка на публикацию (ADR-0065). Каскад — то, ради чего разделение и делалось:
    // удалили релиз → ушли и доставки, и отметки о прочтении, одной командой вместо
    // согласования трёх таблиц и прод-тома вручную.
    releaseId: fkColumn('release_id').references(() => releases.id, { onDelete: 'cascade' }),
    ...timestamps(),
  },
  (table) => [
    index('notifications_account_id_idx').on(table.accountId),
    index('notifications_release_id_idx').on(table.releaseId),
    index('notifications_created_at_idx').on(table.createdAt),
    // Одна broadcast-доставка на публикацию. Раньше идемпотентность сида держалась на
    // `notifications.key`, но ключ — свойство публикации и уехал в `releases` (2.9.2·0).
    // Инвариант тот же, выражен там, где он и живёт: у релиза не может быть двух рассылок.
    // Частичный (`where account_id is null`) — персональных уведомлений про релиз может быть
    // сколько угодно, и они этому правилу не подчиняются.
    uniqueIndex('notifications_release_broadcast_unique')
      .on(table.releaseId)
      .where(sql`${table.accountId} is null`),
    check('notifications_kind_check', sql`${table.kind} in ('release', 'system', 'personal')`),
  ],
);

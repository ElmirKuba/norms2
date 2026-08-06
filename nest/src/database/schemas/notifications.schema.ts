import { sql } from 'drizzle-orm';
import { check, index, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
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
    contentFile: varchar('content_file', { length: 255 }),
    // Чем является содержимое (2.9.2·4): 'md' — файл с текстом, 'page' — страница фронта
    // (лендинг релиза; файла нет, бэк её не хранит). Default 'md' — чтобы существующие ноты
    // и все будущие патчи получали текстовый формат без единой правки сидера.
    contentFormat: varchar('content_format', { length: 8 })
      .$type<NotificationContentFormat>()
      .notNull()
      .default('md'),
    key: varchar('key', { length: 128 }),
    // Ссылка на публикацию (ADR-0065). Каскад — то, ради чего разделение и делалось:
    // удалили релиз → ушли и доставки, и отметки о прочтении, одной командой вместо
    // согласования трёх таблиц и прод-тома вручную.
    releaseId: fkColumn('release_id').references(() => releases.id, { onDelete: 'cascade' }),
    // Отметка о вещании во внешний канал (2.9.1): null — ещё не объявляли.
    broadcastedAt: timestamp('broadcasted_at', { withTimezone: true }),
    // Дата ВЫПУСКА (2.9.1·15), а не записи строки. `created_at` — это момент, когда сидер
    // положил ноту в базу: он меняется при пересеве и врёт про возраст релиза. Null у
    // персональных уведомлений — там дата создания и есть дата события.
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index('notifications_account_id_idx').on(table.accountId),
    index('notifications_release_id_idx').on(table.releaseId),
    index('notifications_created_at_idx').on(table.createdAt),
    uniqueIndex('notifications_key_unique').on(table.key),
    check('notifications_kind_check', sql`${table.kind} in ('release', 'system', 'personal')`),
    check('notifications_content_format_check', sql`${table.contentFormat} in ('md', 'page')`),
  ],
);

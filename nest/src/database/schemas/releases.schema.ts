import { sql } from 'drizzle-orm';
import { check, index, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { ReleaseFull } from '../../modules/notifications/interfaces/release-full.interface';
import type { NotificationContentFormat } from '../../modules/notifications/interfaces/notification-pure.interface';

/**
 * releases — **публикация** релиза (колонки 1:1 с ReleaseFull, [ADR-0065](../../../../docs/decisions/0065-release-vs-notification-split.md)).
 *
 * Отделена от `notifications` намеренно: публикация существует сама по себе и видна снаружи без
 * аккаунта, а уведомление — это доставка события конкретному человеку. Пока они делили одну
 * таблицу, половина колонок у каждой строки была пустой по построению (`account_id` у релиза,
 * `key`/`published_at`/`broadcasted_at` у персонального), и `check` этого выразить не мог.
 *
 * `key` — публичный адрес (`/releases/release-2.9.1`) и одновременно ключ идемпотентного сида,
 * поэтому unique и NOT NULL: строка без ключа здесь бессмысленна.
 */
export const releases = defineTableWithSchema<ReleaseFull>()(
  'releases',
  {
    id: idColumn(),
    key: varchar('key', { length: 128 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    contentFile: varchar('content_file', { length: 255 }),
    contentFormat: varchar('content_format', { length: 8 })
      .$type<NotificationContentFormat>()
      .notNull()
      .default('md'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    broadcastedAt: timestamp('broadcasted_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('releases_key_unique').on(table.key),
    // Витрина всегда сортирует по дате выпуска с откатом на дату записи.
    index('releases_published_at_idx').on(table.publishedAt),
    check('releases_content_format_check', sql`${table.contentFormat} in ('md', 'page')`),
  ],
);

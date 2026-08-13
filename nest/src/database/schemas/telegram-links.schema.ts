import { boolean, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { TelegramLinkFull } from '../../modules/telegram/interfaces/telegram-link-full.interface';

/**
 * telegram_links — привязка аккаунта к чату с ботом (2.9.1·8, применяется в ·14).
 *
 * Нужна для заявок на дополнительные приглашения: начислять квоту по словам человека нельзя,
 * нужна доказанная связь «этот чат — этот аккаунт». Служит заделом под будущие персональные
 * уведомления, но **сама по себе их не включает**
 * ([ADR-0064 §12](../../../../docs/decisions/0064-telegram-release-channel.md)).
 *
 * **`notifications_allowed` — отдельное поле, а не факт наличия строки.** Это два разных
 * согласия: человек писал боту, чтобы попасть внутрь, а не чтобы получать сообщения. Молча
 * превратить одно в другое — ровно тот трюк, за который мы ругаем чужие продукты.
 */
export const telegramLinks = defineTableWithSchema<TelegramLinkFull>()(
  'telegram_links',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    chatId: varchar('chat_id', { length: 32 }).notNull(),
    // По умолчанию false: согласие спрашивается явно (·15), а не выводится из привязки.
    notificationsAllowed: boolean('notifications_allowed').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    // Уникальность с ОБЕИХ сторон: один аккаунт — один чат, один чат — один аккаунт.
    // Иначе один чат мог бы управлять квотой нескольких аккаунтов, а это дыра в ·13.
    uniqueIndex('telegram_links_account_id_unique').on(table.accountId),
    uniqueIndex('telegram_links_chat_id_unique').on(table.chatId),
  ],
  // Жёсткое удаление (ADR-0068): отвязка обязана стирать связь с чужим сервисом, а не прятать её.
  { paranoid: false },
);

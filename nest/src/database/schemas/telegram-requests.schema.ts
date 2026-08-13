import { sql } from 'drizzle-orm';
import { check, index, integer, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { inviteCodes } from './invite-codes.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { TelegramRequestFull } from '../../modules/telegram/interfaces/telegram-request-full.interface';
import type {
  TelegramRequestStatus,
  TelegramRequestType,
} from '../../modules/telegram/interfaces/telegram-request-pure.interface';

/**
 * telegram_requests — заявки, поданные через бота (2.9.1·8): на вступление и на
 * дополнительные приглашения.
 *
 * **Здесь лежит карточка, а не собранная информация** (формулировка Elmir,
 * [ADR-0064 §10](../../../../docs/decisions/0064-telegram-release-channel.md)): кто написал,
 * чего просит, чем закончилось. **Ни имени, ни возраста, ни текста «зачем» в таблице нет** —
 * недособранный черновик живёт в памяти процесса, а готовый текст остаётся в переписке
 * владельца с ботом. На диск попадает только `owner_message_id`, по которому бот может
 * переслать это сообщение обратно.
 */
export const telegramRequests = defineTableWithSchema<TelegramRequestFull>()(
  'telegram_requests',
  {
    id: idColumn(),
    // Чат заявителя. Для `join` это единственный способ прислать код: аккаунта ещё нет.
    chatId: varchar('chat_id', { length: 32 }).notNull(),
    type: varchar('type', { length: 16 }).$type<TelegramRequestType>().notNull(),
    status: varchar('status', { length: 16 }).$type<TelegramRequestStatus>().notNull(),
    // Только у `more_invites` и только из привязки: начислять квоту по словам человека нельзя.
    accountId: fkColumn('account_id').references(() => accounts.id),
    // Код удаляется при регистрации, поэтому SET NULL, а не CASCADE: заявку удалять нельзя,
    // она — история решения. Побочный смысл полезен: ссылка жива → код выдан и не использован;
    // стала null → человек зарегистрировался (или код отозвали).
    inviteCodeId: fkColumn('invite_code_id').references(() => inviteCodes.id, {
      onDelete: 'set null',
    }),
    // Сообщение с текстом заявки в личке владельца — чтобы бот переслал его по кнопке.
    ownerMessageId: integer('owner_message_id'),
    // Причина решения: у одобрения станет подписью к приглашению, у отказа уйдёт человеку.
    decisionReason: text('decision_reason'),
    // Сколько приглашений начислено по `more_invites`. Квота в аккаунте — общая сумма, и по ней
    // уже не сказать, что дали именно по этой просьбе; без числа история решений неполна.
    grantedAmount: integer('granted_amount'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    // Очередь владельца и поиск протухших (старше 7 дней) идут по статусу и дате.
    index('telegram_requests_status_created_at_idx').on(table.status, table.createdAt),
    index('telegram_requests_chat_id_idx').on(table.chatId),
    // ОДНА незакрытая заявка на чат — гарантия БД, а не проверка в коде: при двух сообщениях
    // подряд проверка «уже есть заявка» успевает пройти дважды, а частичный unique — нет.
    uniqueIndex('telegram_requests_one_pending_per_chat')
      .on(table.chatId)
      .where(sql`status = 'pending'`),
    check('telegram_requests_type_check', sql`${table.type} in ('join', 'more_invites')`),
    check(
      'telegram_requests_status_check',
      sql`${table.status} in ('pending', 'approved', 'rejected', 'expired')`,
    ),
    // `more_invites` без аккаунта бессмысленна (некому начислять), `join` с аккаунтом —
    // противоречие (человек ещё не зарегистрирован). Проверяем в БД, а не только в домене.
    // Начисление бывает только положительным: «выдал ноль» — это отказ, у него свой статус.
    check(
      'telegram_requests_granted_amount_check',
      sql`${table.grantedAmount} is null or ${table.grantedAmount} > 0`,
    ),
    check(
      'telegram_requests_account_by_type_check',
      sql`(${table.type} = 'more_invites' and ${table.accountId} is not null)
          or (${table.type} = 'join' and ${table.accountId} is null)`,
    ),
  ],
);

import { sql } from 'drizzle-orm';
import { bigint, check, integer, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AccountFull } from '../../modules/account/interfaces/account-full.interface';

/**
 * accounts — аккаунт (идентичность + вход + квота инвайтов). Корень всех связей.
 * Набор колонок проверяется TS на 1:1-соответствие AccountFull (ADR-0033).
 * Уникальность логина — по lower(login). version — optimistic lock (ADR-0035).
 */
export const accounts = defineTableWithSchema<AccountFull>()(
  'accounts',
  {
    id: idColumn(),
    login: varchar('login', { length: 32 }).notNull(),
    alias: varchar('alias', { length: 32 }).notNull(),
    avatar: varchar('avatar'),
    passwordHash: text('password_hash').notNull(),
    registrationSource: varchar('registration_source', { length: 8 }).notNull(),
    invitesRemaining: integer('invites_remaining').notNull().default(3),
    recoveryRequiredCount: integer('recovery_required_count'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
    // Зона, про которую человек сказал «не спрашивать» (2.10·A3). Отказ привязан к КОНКРЕТНОЙ
    // зоне, а не выключает предложения вообще: уехал в командировку — отказался один раз;
    // вернулся домой или поехал дальше — отказ забывается сам. В логике нет ни одной даты,
    // поэтому нечему протухать и нечего чинить при переводе часов.
    dismissedTimezone: varchar('dismissed_timezone', { length: 64 }),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    version: bigint('version', { mode: 'number' }).notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    // Частичный unique (2.9.3·29.1, реш. Elmir 14.08.2026): удалённая строка **не занимает**
    // логин. Иначе paranoid половинчатый — для домена аккаунта нет, а зарегистрироваться под тем
    // же логином нельзя, и человеку приходится объяснять, почему «занято» то, чего не существует.
    uniqueIndex('accounts_login_lower_unique')
      .on(sql`lower(${table.login})`)
      .where(sql`deleted_at is null`),
    check(
      'accounts_registration_source_check',
      sql`${table.registrationSource} in ('free', 'invite', 'seed')`,
    ),
  ],
);

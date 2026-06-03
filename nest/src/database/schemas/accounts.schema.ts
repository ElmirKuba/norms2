import { sql } from 'drizzle-orm';
import { bigint, check, integer, pgTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { idColumn, timestamps } from './_shared';

/**
 * accounts — аккаунт (идентичность + вход + квота инвайтов). Корень всех связей.
 * Уникальность логина — по lower(login). version — optimistic lock (ADR-0035).
 */
export const accounts = pgTable(
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
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    version: bigint('version', { mode: 'number' }).notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('accounts_login_lower_unique').on(sql`lower(${table.login})`),
    check(
      'accounts_registration_source_check',
      sql`${table.registrationSource} in ('free', 'invite', 'seed')`,
    ),
  ],
);

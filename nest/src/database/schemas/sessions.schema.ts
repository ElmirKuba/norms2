import { index, text, timestamp } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { SessionFull } from '../../modules/sessions/interfaces/session-full.interface';

/**
 * sessions — refresh-токены/устройства (N:1 к accounts; колонки 1:1 с SessionFull).
 * Ротация через CAS по token_hash (ADR-0035). Access-JWT не хранится.
 */
export const sessions = defineTableWithSchema<SessionFull>()(
  'sessions',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index('sessions_account_id_idx').on(table.accountId),
    index('sessions_token_hash_idx').on(table.tokenHash),
  ],
);

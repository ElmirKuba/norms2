import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';

/**
 * invitations — реализованное ребро дерева приглашений (1:1 к accounts через
 * UNIQUE(account_id)). У корней (free/seed) строки нет. Дерево — рекурсивный CTE.
 */
export const invitations = pgTable(
  'invitations',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    inviterId: fkColumn('inviter_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    reason: text('reason').notNull(),
    invitedAt: timestamp('invited_at', { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('invitations_account_id_unique').on(table.accountId),
    index('invitations_inviter_id_idx').on(table.inviterId),
  ],
);

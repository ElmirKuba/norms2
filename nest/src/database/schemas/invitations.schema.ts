import { index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { InvitationFull } from '../../modules/invites/interfaces/invitation-full.interface';

/**
 * invitations — ребро дерева приглашений (1:1 к accounts через UNIQUE(account_id);
 * колонки 1:1 с InvitationFull). У корней (free/seed) строки нет. Дерево — CTE.
 */
export const invitations = defineTableWithSchema<InvitationFull>()(
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

import { index, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { InviteCodeFull } from '../../modules/invites/interfaces/invite-code-full.interface';

/**
 * invite_codes — живые (pending) коды приглашений (колонки 1:1 с InviteCodeFull).
 * Применённые/отозванные/истёкшие удаляются. code уникален; expires_at = +TTL.
 */
export const inviteCodes = defineTableWithSchema<InviteCodeFull>()(
  'invite_codes',
  {
    id: idColumn(),
    code: varchar('code', { length: 10 }).notNull(),
    inviterId: fkColumn('inviter_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    reason: text('reason').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('invite_codes_code_unique').on(table.code),
    index('invite_codes_inviter_id_idx').on(table.inviterId),
  ],
);

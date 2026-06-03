import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';

/**
 * bans — баны (N:1 банивший banner, N:1 цель target). «Забанен» — производное
 * (EXISTS active). Снятие — active=false (история сохраняется). Один активный
 * бан на пару (banner, target) — partial unique.
 */
export const bans = pgTable(
  'bans',
  {
    id: idColumn(),
    bannerId: fkColumn('banner_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    targetId: fkColumn('target_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'restrict' }),
    reason: text('reason').notNull(),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    index('bans_target_active_idx').on(table.targetId, table.active),
    uniqueIndex('bans_banner_target_active_unique')
      .on(table.bannerId, table.targetId)
      .where(sql`${table.active}`),
  ],
);

import { sql } from 'drizzle-orm';
import { boolean, index, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { BanFull } from '../../modules/bans/interfaces/ban-full.interface';

/**
 * bans — баны (колонки 1:1 с BanFull). «Забанен» — производное (EXISTS active).
 * Снятие — active=false (история сохраняется). Один активный бан на пару
 * (banner, target) — partial unique.
 */
export const bans = defineTableWithSchema<BanFull>()(
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

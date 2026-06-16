import { date, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { microWins } from './micro-wins.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { MicroWinLogFull } from '../../modules/accent/micro-wins/interfaces/micro-win-log-full.interface';

/**
 * micro_win_logs — факты выполнения микро-побед (иммутабельны: только created_at).
 * **Дневной лимит:** uniqueIndex `(micro_win_id, occurred_on)` — 1 лог в день на победу
 * (повторный complete в тот же день → ON CONFLICT DO NOTHING, no-op). `occurred_on` —
 * локальная дата в TZ аккаунта (вычисляет use-case, 2.2·4). Очки начисляет 2.8 по этим логам.
 */
export const microWinLogs = defineTableWithSchema<MicroWinLogFull>()(
  'micro_win_logs',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    microWinId: fkColumn('micro_win_id')
      .notNull()
      .references(() => microWins.id, { onDelete: 'cascade' }),
    occurredOn: date('occurred_on', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('micro_win_logs_win_day_unique').on(table.microWinId, table.occurredOn),
  ],
);

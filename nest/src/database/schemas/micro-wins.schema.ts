import { boolean, check, integer, jsonb, text, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type {
  MicroWinCategory,
  MicroWinFull,
  UserState,
} from '../../modules/accent/micro-wins/interfaces/micro-win-full.interface';

/**
 * micro_wins — микро-победы пользователя (per-account; колонки 1:1 с MicroWinFull).
 * `category` — varchar-ключ (как DomainKey), `disabled_for_states` — jsonb UserState[].
 * CHECK на `energy_cost` 1..3 и `duration_seconds` 0..300 — защита-в-глубину; дружелюбная
 * валидация — на domain-service (2.2·2). Очки за выполнение — через micro_win_logs (2.8).
 */
export const microWins = defineTableWithSchema<MicroWinFull>()(
  'micro_wins',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    category: varchar('category', { length: 16 }).$type<MicroWinCategory>().notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    energyCost: integer('energy_cost').notNull(),
    effect: text('effect'),
    disabledForStates: jsonb('disabled_for_states').$type<UserState[]>(),
    isActive: boolean('is_active').notNull().default(true),
    isStarter: boolean('is_starter').notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    check('micro_wins_energy_cost_range', sql`${table.energyCost} BETWEEN 1 AND 3`),
    check('micro_wins_duration_range', sql`${table.durationSeconds} BETWEEN 0 AND 300`),
  ],
);

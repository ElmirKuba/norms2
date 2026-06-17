import { timestamp } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AccentSettingsFull } from '../../modules/accent/settings/interfaces/accent-settings-full.interface';

/**
 * accent_settings — настройки/состояние раздела «Акцент» (1:1 с account; колонки
 * 1:1 с AccentSettingsFull). PK=FK=account_id (паттерн 1:1 как Identity). `paused_from`
 * — пауза-режим (болезнь/отпуск): задано → серии замораживаются, ролловер не наказывает.
 * `timezone` здесь НЕ хранится — платформенное поле в `accounts` (ADR-0028).
 */
export const accentSettings = defineTableWithSchema<AccentSettingsFull>()(
  'accent_settings',
  {
    accountId: fkColumn('account_id')
      .primaryKey()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    pausedFrom: timestamp('paused_from', { withTimezone: true }),
    starterMicroWinsSeededAt: timestamp('starter_micro_wins_seeded_at', { withTimezone: true }),
    ...timestamps(),
  },
);

import { text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AppSettingFull } from '../../modules/settings/interfaces/app-setting-full.interface';

/**
 * app_settings — рантайм-настройки (2.9.3·4; колонки 1:1 с AppSettingFull, ADR-0033).
 *
 * Строка появляется, когда настройку впервые меняют; до этого действует значение из `.env`.
 * Значение хранится строкой намеренно: разбирает его читатель, и справочник не привязан к типам.
 *
 * `updated_by` — `set null` при удалении аккаунта: кто менял, важно, но удаление человека не
 * должно уносить с собой настройку продукта.
 */
export const appSettings = defineTableWithSchema<AppSettingFull>()(
  'app_settings',
  {
    id: idColumn(),
    key: varchar('key', { length: 64 }).notNull(),
    value: text('value').notNull(),
    updatedBy: fkColumn('updated_by').references(() => accounts.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  // Обычный индекс по колонке, а не по lower(key): ключи — машинные константы вида
  // `telegram.bot.paused`, всегда в нижнем регистре (сервис нормализует при записи).
  // Функциональный индекс нельзя указать целью `on conflict`, а он тут и не нужен.
  (table) => [uniqueIndex('app_settings_key_unique').on(table.key)],
);

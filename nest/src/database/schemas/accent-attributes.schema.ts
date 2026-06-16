import { boolean, integer, text, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AccentAttributeFull } from '../../modules/accent/reference/interfaces/accent-attribute-full.interface';

/**
 * accent_attributes — справочник RPG-атрибутов (каталог `Attribute`, ADR-0028;
 * колонки 1:1 с AccentAttributeFull). PK = `key` (slug). Наполняется сидом (2.1·4).
 * Цели/привычки прокачивают атрибуты по ключам (паучья диаграмма баланса).
 */
export const accentAttributes = defineTableWithSchema<AccentAttributeFull>()(
  'accent_attributes',
  {
    key: varchar('key', { length: 64 }).primaryKey(),
    title: text('title').notNull(),
    position: integer('position').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
);

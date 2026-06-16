import { boolean, integer, text, varchar } from 'drizzle-orm/pg-core';
import { timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AccentDomainFull } from '../../modules/accent/reference/interfaces/accent-domain-full.interface';

/**
 * accent_domains — справочник сфер жизни (каталог `DomainKey`; колонки 1:1 с
 * AccentDomainFull). PK = `key` (slug), как `Achievement.code` — каталог, не сущность.
 * Наполняется сидом (2.1·4). Цели/привычки хранят `domainKey` строкой-ключом.
 */
export const accentDomains = defineTableWithSchema<AccentDomainFull>()(
  'accent_domains',
  {
    key: varchar('key', { length: 64 }).primaryKey(),
    title: text('title').notNull(),
    position: integer('position').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
);

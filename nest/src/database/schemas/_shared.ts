import { timestamp, varchar } from 'drizzle-orm/pg-core';

// Общие конвенции колонок (ADR-0016 id, ADR-0011 таймстампы). Функции, а не
// константы — чтобы каждая таблица получала свежие билдеры колонок.

/** PK id: строка формата uuidv7___unixmillis (varchar(52), ADR-0016). */
export const idColumn = () => varchar('id', { length: 52 }).primaryKey();

/** FK-колонка на accounts.id (varchar(52)); .references навешивается в таблице. */
export const fkColumn = (name: string) => varchar(name, { length: 52 });

/** created_at + updated_at (timestamptz, not null); updated_at автообновляется (ADR-0011). */
export const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

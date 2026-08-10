import { sql } from 'drizzle-orm';
import { text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { RoleFull } from '../../modules/account/interfaces/role-full.interface';

/**
 * roles — справочник ролей (2.9.3; колонки 1:1 с RoleFull, ADR-0033).
 *
 * **Почему таблица, а не enum в коде** (реш. Elmir 09.08.2026): новая роль добавляется строкой,
 * без миграции и без правки `check`. Права в коде проверяются по `code`, поэтому он уникален
 * без учёта регистра и у существующей роли не меняется — иначе проверки молча разъедутся.
 */
export const roles = defineTableWithSchema<RoleFull>()(
  'roles',
  {
    id: idColumn(),
    code: varchar('code', { length: 32 }).notNull(),
    title: varchar('title', { length: 64 }).notNull(),
    description: text('description'),
    ...timestamps(),
  },
  (table) => [uniqueIndex('roles_code_lower_unique').on(sql`lower(${table.code})`)],
);

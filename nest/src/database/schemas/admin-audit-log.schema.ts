import { index, jsonb, timestamp, varchar } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { fkColumn, idColumn } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AuditEntryFull } from '../../modules/audit/interfaces/audit-entry-full.interface';

/**
 * admin_audit_log — журнал действий администратора (2.9.3·6; колонки 1:1 с AuditEntryFull,
 * ADR-0033).
 *
 * **Таблица только дописывается.** Ни `updatedAt`, ни методов обновления в порте нет: строка,
 * которую можно изменить, журналом не является. Отсюда и отступление от общего `timestamps()` —
 * здесь одна метка времени вместо двух.
 *
 * **`actor_account_id` — `set null`, а НЕ каскад.** Каскад снёс бы следы вместе с аккаунтом
 * ровно тогда, когда журнал и нужен. Логин продублирован снимком (`actor_login`), поэтому после
 * удаления аккаунта запись остаётся читаемой: «кто» известно, ссылка на живой профиль потеряна.
 *
 * **Цель не FK.** Целью бывает аккаунт, ключ настройки или ключ релиза — разные таблицы и разные
 * форматы идентификатора. Внешний ключ пришлось бы заводить на каждый род и всё равно оставить
 * nullable; вместо этого храним пару «род + идентификатор» и снимок подписи.
 */
export const adminAuditLog = defineTableWithSchema<AuditEntryFull>()(
  'admin_audit_log',
  {
    id: idColumn(),
    actorAccountId: fkColumn('actor_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    actorLogin: varchar('actor_login', { length: 64 }),
    action: varchar('action', { length: 64 }).notNull(),
    targetType: varchar('target_type', { length: 32 }),
    targetId: varchar('target_id', { length: 128 }),
    targetLabel: varchar('target_label', { length: 128 }),
    details: jsonb('details').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Журнал читается одним способом — «последние сверху», иногда с фильтром по действию или по
  // тому, кто действовал. Под это два индекса; текстового поиска здесь не будет.
  (table) => [
    index('admin_audit_log_created_at_idx').on(table.createdAt),
    index('admin_audit_log_actor_idx').on(table.actorAccountId),
  ],
);

import { index, uniqueIndex } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema';
import { roles } from './roles.schema';
import { fkColumn, idColumn, timestamps } from './_shared';
import { defineTableWithSchema } from './define-table.helper';
import type { AccountRoleFull } from '../../modules/account/interfaces/account-role-full.interface';

/**
 * account_roles — кому какая роль выдана (2.9.3; колонки 1:1 с AccountRoleFull, ADR-0033).
 *
 * **Многие-ко-многим** (реш. Elmir 09.08.2026): человек может быть одновременно пользователем и
 * админом — это две строки. Одна и та же роль дважды одному человеку не выдаётся (unique на пару).
 *
 * **Каскады разные, и это намеренно.** Удалили аккаунт — его роли уходят с ним (`cascade`).
 * Удалить роль, которая кому-то выдана, нельзя (`restrict`): иначе строки связи осиротели бы, а
 * снятие роли — это осознанная операция админки, а не побочный эффект чистки справочника.
 */
export const accountRoles = defineTableWithSchema<AccountRoleFull>()(
  'account_roles',
  {
    id: idColumn(),
    accountId: fkColumn('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    roleId: fkColumn('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex('account_roles_account_role_unique').on(table.accountId, table.roleId),
    // «Кто у нас админы» — частый запрос админки, он идёт от роли к людям.
    index('account_roles_role_idx').on(table.roleId),
  ],
);

import type { AccountRoleBase } from './account-role-base.interface';

/**
 * AccountRoleFull — полная строка `account_roles` (≈ строка БД, ADR-0033): Base + PK и метки.
 * `createdAt` = когда роль выдана. Ключи 1:1 с колонками схемы.
 */
export interface AccountRoleFull extends Required<AccountRoleBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда роль выдана. */
  createdAt: Date;
  /** Когда изменена. */
  updatedAt: Date;
}

import type { RoleBase } from './role-base.interface';

/**
 * RoleFull — полная строка `roles` (≈ строка БД, ADR-0033): Base + PK и метки.
 * Ключи 1:1 с колонками схемы.
 */
export interface RoleFull extends Required<RoleBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда роль заведена. */
  createdAt: Date;
  /** Когда изменена. */
  updatedAt: Date;
}

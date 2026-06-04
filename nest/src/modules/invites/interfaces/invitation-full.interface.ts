import type { InvitationBase } from './invitation-base.interface';

/**
 * InvitationFull — полная строка invitations (ребро дерева, ≈ строка БД,
 * ADR-0033): Base + PK и системные метки. Ключи 1:1 с колонками схемы.
 */
export interface InvitationFull extends Required<InvitationBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён. */
  updatedAt: Date;
}

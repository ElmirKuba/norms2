/**
 * InvitationFull — полный контракт строки invitations (ребро дерева, ADR-0033).
 * Ключи 1:1 с колонками схемы. На этапе I развернём в Pure → Base → Full.
 */
export interface InvitationFull {
  /** PK. */
  id: string;
  /** FK на accounts.id (приглашённый, уникален → 1:1). */
  accountId: string;
  /** FK на accounts.id (пригласивший). */
  inviterId: string;
  /** Причина (копия из кода при погашении). */
  reason: string;
  /** Момент погашения. */
  invitedAt: Date;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён. */
  updatedAt: Date;
}

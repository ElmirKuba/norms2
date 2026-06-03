/**
 * InviteCodeFull — полный контракт строки invite_codes (живой код, ADR-0033).
 * Ключи 1:1 с колонками схемы. На этапе I развернём в Pure → Base → Full.
 */
export interface InviteCodeFull {
  /** PK. */
  id: string;
  /** Код приглашения (10 символов, уникален). */
  code: string;
  /** FK на accounts.id (создатель). */
  inviterId: string;
  /** Причина приглашения. */
  reason: string;
  /** Срок жизни кода. */
  expiresAt: Date;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён. */
  updatedAt: Date;
}

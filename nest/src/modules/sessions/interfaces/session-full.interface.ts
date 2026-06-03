/**
 * SessionFull — полный контракт строки sessions (refresh/устройство, ADR-0033).
 * Ключи 1:1 с колонками схемы. На этапе A/R развернём в Pure → Base → Full.
 */
export interface SessionFull {
  /** PK. */
  id: string;
  /** FK на accounts.id. */
  accountId: string;
  /** Хеш refresh-токена. */
  tokenHash: string;
  /** User-Agent устройства или null. */
  userAgent: string | null;
  /** Срок жизни refresh. */
  expiresAt: Date;
  /** Момент отзыва или null. */
  revokedAt: Date | null;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён (≈ last-used). */
  updatedAt: Date;
}

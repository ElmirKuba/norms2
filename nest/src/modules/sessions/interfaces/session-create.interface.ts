/**
 * SessionCreate — данные для создания сессии (id генерит домен; revokedAt и
 * метки — дефолтами БД). ADR-0033.
 */
export interface SessionCreate {
  /** FK на accounts.id. */
  accountId: string;
  /** SHA-256 refresh-токена. */
  tokenHash: string;
  /** User-Agent устройства или null. */
  userAgent: string | null;
  /** Срок жизни refresh. */
  expiresAt: Date;
}

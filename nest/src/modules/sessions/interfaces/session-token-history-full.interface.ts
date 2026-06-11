/**
 * SessionTokenHistoryFull — архив ротированных (более не активных) хешей
 * refresh-токенов сессии (ADR-0033; колонки 1:1 со схемой). Append-only: строка
 * добавляется при каждой ротации (старый хеш). Предъявление токена, чей хеш есть
 * здесь, = реплей уже ротированного токена → reuse-detect (отзыв всех сессий).
 * Без `updatedAt` — запись неизменяема.
 */
export interface SessionTokenHistoryFull {
  /** PK. */
  id: string;
  /** FK на sessions.id (семья/устройство, к которому относился токен). */
  sessionId: string;
  /** SHA-256 ротированного refresh-токена (глобально уникален). */
  tokenHash: string;
  /** Когда хеш заархивирован (момент ротации). */
  createdAt: Date;
}

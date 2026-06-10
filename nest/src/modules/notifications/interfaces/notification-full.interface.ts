import type { NotificationBase } from './notification-base.interface';

/**
 * NotificationFull — полная строка notifications (≈ строка БД, ADR-0033): Base +
 * PK и системные метки. Ключи 1:1 с колонками схемы (defineTableWithSchema).
 */
export interface NotificationFull extends Required<NotificationBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}

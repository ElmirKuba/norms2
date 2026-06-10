import type { NotificationReadBase } from './notification-read-base.interface';

/**
 * NotificationReadFull — полная строка notification_reads (≈ строка БД, ADR-0033):
 * Base + PK и метки. `createdAt` = когда прочитано. Ключи 1:1 с колонками схемы.
 */
export interface NotificationReadFull extends Required<NotificationReadBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда прочитано (создание строки). */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}

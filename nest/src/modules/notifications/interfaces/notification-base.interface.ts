import type { NotificationPure } from './notification-pure.interface';

/**
 * NotificationBase — Pure + поля адресации/создания (ADR-0033): `accountId` (null =
 * broadcast всем, set = персональное конкретному), `key` (стабильный ключ для
 * идемпотентного сида релизов; null у персональных/ad-hoc).
 */
export interface NotificationBase extends NotificationPure {
  /** FK на accounts.id — адресат (null = broadcast всем). */
  accountId: string | null;
  /** Уникальный стабильный ключ (идемпотентный сид релизов) или null. */
  key: string | null;
  /**
   * Когда нота объявлена во внешний канал (Telegram, 2.9.1) или null — ещё не объявляли.
   *
   * **Зачем поле, а не флаг в памяти:** сидер отрабатывает при каждом старте бэка, и без отметки
   * в БД канал получал бы все десять релизов заново на каждый деплой. Публикация идемпотентна
   * именно по этому полю.
   */
  broadcastedAt: Date | null;
}

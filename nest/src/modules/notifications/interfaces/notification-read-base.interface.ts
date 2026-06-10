/**
 * NotificationReadBase — связь «кто что прочитал» (ADR-0033): пара (аккаунт,
 * уведомление). Наличие строки = уведомление прочитано данным пользователем.
 */
export interface NotificationReadBase {
  /** FK на accounts.id — кто прочитал. */
  accountId: string;
  /** FK на notifications.id — что прочитано. */
  notificationId: string;
}

/**
 * Состояние привязки Telegram для экрана настроек (2.9.1·14).
 *
 * `chat_id` сюда намеренно не входит: экрану он не нужен, а это идентификатор человека в чужом
 * сервисе.
 */
export interface TelegramLinkStatus {
  /** Привязан ли чат к аккаунту. */
  linked: boolean;
  /** Когда привязали (ISO) или null. */
  linkedAt: string | null;
  /** Разрешил ли человек боту писать ему (отдельное согласие, ·15). */
  notificationsAllowed: boolean;
}

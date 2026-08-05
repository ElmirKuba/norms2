/** Состояние привязки Telegram (ответ `GET /telegram/link`). */
export interface TelegramLinkStatus {
  /** Привязан ли чат к аккаунту. */
  linked: boolean;
  /** Когда привязали (ISO) или null. */
  linkedAt: string | null;
  /** Разрешил ли человек боту писать ему — отдельное согласие. */
  notificationsAllowed: boolean;
  /**
   * Имя бота без `@`.
   *
   * Приходит с бэка, а не зашито здесь: на стейдже и на проде боты разные, и захардкоженное имя
   * отправляло бы тестового человека к боевому боту. Пусто — бот на стенде не настроен.
   */
  botUsername: string;
}

/** Одноразовый код привязки (ответ `POST /telegram/link/code`). */
export interface TelegramLinkCodeView {
  /** Код, который человек отправляет боту. */
  code: string;
  /** Сколько секунд он действует. */
  expiresInSeconds: number;
}

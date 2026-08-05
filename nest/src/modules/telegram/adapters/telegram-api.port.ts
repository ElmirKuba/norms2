/** DI-токен исходящего порта Bot API. */
export const TELEGRAM_API = Symbol('TELEGRAM_API');

/** Инлайн-кнопка. */
export interface TelegramButton {
  /** Надпись. */
  text: string;
  /**
   * Данные нажатия. Лимит Telegram — **64 байта**, а наши id занимают 52 символа, так что на
   * префикс действия остаётся 12: держим их короткими (`ok:`, `no:`, `i1:`).
   */
  callbackData: string;
}

/**
 * Исходящий порт Bot API: всё, что бот **говорит** (2.9.1·9).
 *
 * Отдельно от `RELEASE_BROADCAST`, хотя оба ходят в Telegram: тот объявляет релизы в канал и
 * умеет ровно одно действие, а этот ведёт диалоги с людьми. Смешать их значило бы связать
 * витрину релизов с приёмной заявок — при том что витрина обязана работать, даже если приёмку
 * отключат совсем.
 */
export interface TelegramApiPort {
  /**
   * Отправляет сообщение.
   * @param chatId Кому.
   * @param text Текст (HTML-разметка Telegram).
   * @param buttons Кнопки: массив рядов.
   * @returns `message_id` отправленного сообщения или null, если не доставлено.
   */
  sendMessage(
    chatId: string,
    text: string,
    buttons?: TelegramButton[][],
  ): Promise<number | null>;

  /**
   * Гасит «часики» на нажатой кнопке. Без этого Telegram крутит их 30 секунд, и человек
   * думает, что бот завис.
   * @param callbackQueryId Идентификатор нажатия.
   * @param text Всплывающая подсказка или undefined.
   * @returns Промис завершения.
   */
  answerCallback(callbackQueryId: string, text?: string): Promise<void>;

  /**
   * Пересылает сообщение — нужно кнопке «Показать текст заявки»: сам текст мы не храним,
   * а переслать его владельцу можем.
   * @param toChatId Кому.
   * @param fromChatId Откуда.
   * @param messageId Что.
   * @returns Промис завершения.
   */
  forwardMessage(toChatId: string, fromChatId: string, messageId: number): Promise<void>;
}

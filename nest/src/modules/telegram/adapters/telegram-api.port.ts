import type { TelegramUpdate } from '../interfaces/telegram-update.interface';

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
   * а переслать его админу можем.
   * @param toChatId Кому.
   * @param fromChatId Откуда.
   * @param messageId Что.
   * @returns Промис завершения.
   */
  forwardMessage(toChatId: string, fromChatId: string, messageId: number): Promise<void>;

  /**
   * Задаёт список команд в меню Telegram.
   *
   * Держим его в коде, а не в BotFather: там он живёт отдельной жизнью и врёт при первой же
   * правке обработчика (поймано 05.08.2026 — команду переписали на коды, а подсказка осталась
   * «/link логин»). Заодно у стейджевого и боевого ботов описания совпадают без ручной сверки.
   * @param commands Команды без ведущего слэша и их описания.
   * @returns Промис завершения.
   */
  setCommands(commands: { command: string; description: string }[]): Promise<void>;

  /**
   * Забирает накопившиеся апдейты (`getUpdates`, режим `polling` — 15.08.2026).
   *
   * **Длинное ожидание, а не опрос по таймеру:** Telegram держит соединение открытым до
   * `timeoutSeconds` и отвечает в момент появления сообщения. Задержка для человека — доли
   * секунды, как с вебхуком, а запросов почти нет.
   *
   * **Подтверждение — через `offset`:** апдейты остаются в очереди Telegram, пока мы не
   * попросим следующие. Упали на середине — те же апдейты придут снова, ничего не теряется.
   * @param offset Идентификатор первого нужного апдейта (`последний обработанный + 1`); 0 — с начала очереди.
   * @param timeoutSeconds Сколько секунд держать соединение открытым.
   * @returns Апдейты или пустой массив (в том числе при сетевом сбое — тогда зовущий просто повторит).
   */
  getUpdates(offset: number, timeoutSeconds: number): Promise<TelegramUpdate[]>;

  /**
   * Снимает вебхук — обязательный шаг перед `getUpdates` (иначе Telegram отвечает 409).
   *
   * **Накопленное не выбрасывается** (`drop_pending_updates` не передаём): сообщения, пришедшие
   * пока доставка не работала, должны дойти до человека, а не исчезнуть при переключении режима.
   * @returns `true`, если Telegram подтвердил.
   */
  deleteWebhook(): Promise<boolean>;
}

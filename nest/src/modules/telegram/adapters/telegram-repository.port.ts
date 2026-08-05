import type { TelegramLinkFull } from '../interfaces/telegram-link-full.interface';
import type { TelegramRequestBase } from '../interfaces/telegram-request-base.interface';
import type { TelegramRequestFull } from '../interfaces/telegram-request-full.interface';
import type { TelegramRequestStatus } from '../interfaces/telegram-request-pure.interface';

/** DI-токен порта репозитория Telegram-заявок и привязок. */
export const TELEGRAM_REPOSITORY = Symbol('TELEGRAM_REPOSITORY');

/** Чем закончилась заявка. */
export interface TelegramRequestDecision {
  /** Новый статус (`approved` | `rejected` | `expired`). */
  status: TelegramRequestStatus;
  /** Причина решения или null (прочерк). */
  decisionReason: string | null;
  /** Выданный код приглашения или null. */
  inviteCodeId: string | null;
}

/**
 * Порт репозитория Telegram-области (БЕЗ ORM): заявки и привязки аккаунтов к чатам.
 */
export interface TelegramRepositoryPort {
  /**
   * Отмечает апдейт обработанным — **атомарно**, вставкой с `ON CONFLICT DO NOTHING`.
   *
   * Telegram повторяет доставку, если вебхук не ответил 200, поэтому «сначала посмотрим, был
   * ли такой, потом запишем» не годится: два повтора подряд успевают пройти проверку оба.
   * @param updateId `update_id` из Bot API.
   * @returns `true`, если апдейт видим впервые; `false` — это повтор, обрабатывать не надо.
   */
  markUpdateProcessed(updateId: number): Promise<boolean>;

  /**
   * Создаёт заявку.
   * @param id Идентификатор.
   * @param data Карточка заявки (без текста — его в БД нет).
   * @returns Созданная строка.
   */
  createRequest(id: string, data: TelegramRequestBase): Promise<TelegramRequestFull>;

  /**
   * Незакрытая заявка этого чата, если есть.
   * @param chatId Чат заявителя.
   * @returns Заявка или null.
   */
  findPendingByChat(chatId: string): Promise<TelegramRequestFull | null>;

  /**
   * Заявка по идентификатору (id приезжает в `callback_data` кнопок).
   * @param id Идентификатор.
   * @returns Заявка или null.
   */
  findRequestById(id: string): Promise<TelegramRequestFull | null>;

  /**
   * Очередь заявок для владельца, новые сверху.
   * @param status Какие показывать.
   * @param limit Сколько.
   * @param offset Сдвиг (пагинация по 5).
   * @returns Заявки.
   */
  listRequestsByStatus(
    status: TelegramRequestStatus,
    limit: number,
    offset: number,
  ): Promise<TelegramRequestFull[]>;

  /**
   * Сколько заявок в статусе (для счётчика `📋 Заявки (N)`).
   * @param status Статус.
   * @returns Количество.
   */
  countRequestsByStatus(status: TelegramRequestStatus): Promise<number>;

  /**
   * Закрывает заявку — **только если она ещё `pending`**.
   *
   * Условие в запросе, а не в коде, потому что решение возможно из двух мест сразу: кнопки под
   * сообщением и списка очереди (·12). Проверка «сначала прочитали, потом записали» тут не
   * спасает — между чтением и записью успевает пройти второй апрув, и человек получит два кода.
   * @param id Заявка.
   * @param decision Чем закончилась.
   * @returns `true`, если закрыли именно этим вызовом; `false` — заявка уже была закрыта.
   */
  decideIfPending(id: string, decision: TelegramRequestDecision): Promise<boolean>;

  /**
   * Помечает протухшими незакрытые заявки старше срока.
   * @param olderThan Граница: всё, что создано раньше.
   * @returns Сколько помечено.
   */
  expirePendingOlderThan(olderThan: Date): Promise<number>;

  /**
   * Привязка по чату.
   * @param chatId Чат.
   * @returns Привязка или null.
   */
  findLinkByChat(chatId: string): Promise<TelegramLinkFull | null>;

  /**
   * Привязка по аккаунту.
   * @param accountId Аккаунт.
   * @returns Привязка или null.
   */
  findLinkByAccount(accountId: string): Promise<TelegramLinkFull | null>;

  /**
   * Создаёт привязку.
   * @param id Идентификатор.
   * @param accountId Аккаунт.
   * @param chatId Чат.
   * @returns Созданная привязка.
   */
  createLink(id: string, accountId: string, chatId: string): Promise<TelegramLinkFull>;

  /**
   * Меняет согласие на уведомления у существующей привязки (·15).
   * @param chatId Чат.
   * @param allowed Разрешено ли писать.
   * @returns Промис завершения.
   */
  setNotificationsAllowed(chatId: string, allowed: boolean): Promise<void>;

  /**
   * Удаляет привязку (`/unlink`).
   * @param chatId Чат.
   * @returns Промис завершения.
   */
  deleteLinkByChat(chatId: string): Promise<void>;
}

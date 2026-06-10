import type { NotificationBase } from '../interfaces/notification-base.interface';
import type { NotificationFull } from '../interfaces/notification-full.interface';
import type { NotificationView } from '../interfaces/notification-view.interface';

/** DI-токен порта репозитория уведомлений. */
export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

/** Строка-отметка «прочитано» для bulk-вставки. */
export interface NotificationReadInsert {
  /** PK отметки. */
  id: string;
  /** Кто прочитал. */
  accountId: string;
  /** Что прочитано. */
  notificationId: string;
}

/**
 * Порт репозитория уведомлений (БЕЗ ORM). «Мои» = broadcast (`accountId IS NULL`)
 * или персональные мне; `read` — производное (есть ли моя строка в reads).
 */
export interface NotificationRepositoryPort {
  /**
   * Создаёт уведомление.
   * @param id Идентификатор.
   * @param data Данные (kind/title/body/contentFile/accountId/key).
   * @returns Созданная строка.
   */
  create(id: string, data: NotificationBase): Promise<NotificationFull>;

  /**
   * Мои уведомления (broadcast + персональные), новые сверху, с флагом `read`.
   * @param accountId Смотрящий.
   * @returns Проекции.
   */
  listForAccount(accountId: string): Promise<NotificationView[]>;

  /**
   * Число непрочитанных моих уведомлений.
   * @param accountId Смотрящий.
   * @returns Количество.
   */
  countUnread(accountId: string): Promise<number>;

  /**
   * Уведомление по id (для проверки адресации перед отметкой).
   * @param id Идентификатор.
   * @returns Строка или null.
   */
  findById(id: string): Promise<NotificationFull | null>;

  /**
   * Отмечает прочитанным (идемпотентно — ON CONFLICT DO NOTHING).
   * @param id PK отметки.
   * @param accountId Кто.
   * @param notificationId Что.
   * @returns Промис завершения.
   */
  insertRead(id: string, accountId: string, notificationId: string): Promise<void>;

  /**
   * Id моих непрочитанных уведомлений (для «отметить все»).
   * @param accountId Смотрящий.
   * @returns Идентификаторы.
   */
  listUnreadIds(accountId: string): Promise<string[]>;

  /**
   * Bulk-вставка отметок «прочитано» (идемпотентно).
   * @param rows Отметки.
   * @returns Промис завершения.
   */
  insertReads(rows: NotificationReadInsert[]): Promise<void>;

  /**
   * Создаёт уведомление, только если его `key` ещё нет (ON CONFLICT DO NOTHING по
   * unique `key`). Идемпотентный сид релиз-нот (ADR-0044/F7): повторный старт не
   * плодит дублей.
   * @param id Идентификатор (используется только при вставке).
   * @param data Данные (обязателен непустой `key`).
   * @returns Промис завершения.
   */
  createIfAbsentByKey(id: string, data: NotificationBase): Promise<void>;
}

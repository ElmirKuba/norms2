import type { NotificationBase } from '../interfaces/notification-base.interface';
import type { NotificationFull } from '../interfaces/notification-full.interface';
import type { NotificationView } from '../interfaces/notification-view.interface';
import type { ReleaseView } from '../interfaces/release-view.interface';

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
   * @returns `true`, если строка создана прямо сейчас; `false` — она уже была (2.9.1: по этому признаку объявляем в канал только новое, а накопленную историю — отдельной командой).
   */
  createIfAbsentByKey(id: string, data: NotificationBase): Promise<boolean>;

  /**
   * Помечает ноту объявленной во внешний канал (2.9.1).
   * @param id Идентификатор ноты.
   * @returns Промис завершения.
   */
  markBroadcasted(id: string): Promise<void>;

  /**
   * Проставляет дату выпуска ноте, у которой её ещё нет (2.9.1·15).
   *
   * Нужен ради **уже засеянных** баз: `createIfAbsentByKey` на существующую ноту не действует,
   * поэтому без досева поле осталось бы пустым и на dev, и на проде — то есть ровно там, где
   * порядок нот и врал. Обновление **только когда `published_at is null`**: правка даты у ноты,
   * которой её однажды поставили, — это уже не сид, а переписывание истории.
   * @param key Ключ ноты.
   * @param publishedAt Дата выпуска.
   * @returns Промис завершения.
   */
  setPublishedAtIfAbsent(key: string, publishedAt: Date): Promise<void>;

  /**
   * Релизные ноты для **публичной** витрины (`kind = 'release'`), новые сверху.
   * Без отметок о прочтении: смотрящего нет, `notification_reads` не участвует.
   * @returns Проекции витрины.
   */
  listReleases(): Promise<ReleaseView[]>;

  /**
   * Одна релизная нота по публичному ключу (`release-2.9.0`).
   * Ищет **только среди релизных**: персональные уведомления по ключу наружу не отдаются.
   * @param key Ключ ноты.
   * @returns Проекция витрины или null.
   */
  findReleaseByKey(key: string): Promise<ReleaseView | null>;

  /**
   * Релизные ноты, ещё не объявленные наружу (`broadcasted_at is null`), старые → новые.
   * Нужен для публикации истории по явной команде: обычный сид объявляет только то, что создал
   * прямо сейчас, а накопленное прошлое ждёт отдельного решения владельца.
   * @returns Ноты в хронологическом порядке.
   */
  listUnbroadcastedReleases(): Promise<NotificationFull[]>;
}

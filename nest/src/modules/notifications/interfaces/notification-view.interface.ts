import type { NotificationContentFormat, NotificationKind } from './notification-pure.interface';

/**
 * NotificationView — строка списка уведомлений (`GET /notifications`). Без
 * `accountId`/`key` (внутреннее); `read` — производное (есть ли моя read-строка).
 */
export interface NotificationView {
  /** PK. */
  id: string;
  /** Вид. */
  kind: NotificationKind;
  /** Заголовок. */
  title: string;
  /** Короткий текст или null. */
  body: string | null;
  /** Путь к .md относительно content/ или null. */
  contentFile: string | null;
  /**
   * Чем является содержимое (2.9.2·4). Колокольчик по этому полю выбирает способ открытия:
   * `md` — модалкой, как сейчас; `page` — переходом на лендинг в новой вкладке. Втискивать
   * страницу с прокруткой в модалку бессмысленно.
   */
  contentFormat: NotificationContentFormat;
  /**
   * Публичный ключ связанной публикации (`release-2.9.2`) или null у персональных (ADR-0065).
   *
   * Колокольчик строит по нему адрес лендинга `/releases/:key`. Внутренний `id` публикации
   * наружу не отдаём: публичный адрес релиза — это ключ, а не строка БД.
   */
  releaseKey: string | null;
  /** Когда создано (момент записи строки). */
  createdAt: Date;
  /**
   * Дата выпуска релиза или null у персональных. Показывать человеку нужно
   * `publishedAt ?? createdAt`: `createdAt` у релизов — это когда сидер положил ноту в базу.
   */
  publishedAt: Date | null;
  /** Прочитано ли мной. */
  read: boolean;
}

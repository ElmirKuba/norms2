import type { NotificationKind } from './notification-pure.interface';

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

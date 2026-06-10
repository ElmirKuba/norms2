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
  /** Когда создано. */
  createdAt: Date;
  /** Прочитано ли мной. */
  read: boolean;
}

// Зеркало контракта уведомлений (`GET /api/v1/notifications`, F5.6).

/** Вид уведомления. */
export type NotificationKind = 'release' | 'system' | 'personal';

/** Проекция уведомления для смотрящего (с флагом прочтения). */
export interface NotificationView {
  /** PK. */
  id: string;
  /** Вид. */
  kind: NotificationKind;
  /** Заголовок. */
  title: string;
  /** Inline-текст или null (тогда контент в `contentFile`). */
  body: string | null;
  /** Путь к `.md` относительно content/ или null (тогда контент в `body`). */
  contentFile: string | null;
  /** Момент создания (ISO-строка из JSON). */
  createdAt: string;
  /** Прочитано ли мной. */
  read: boolean;
}

/** Ответ счётчика непрочитанных. */
export interface UnreadCountResponse {
  /** Число непрочитанных. */
  count: number;
}

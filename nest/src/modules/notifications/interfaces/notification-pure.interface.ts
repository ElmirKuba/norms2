/** Вид уведомления: релиз / системное / персональное. */
export type NotificationKind = 'release' | 'system' | 'personal';

/**
 * NotificationPure — содержательные поля уведомления (ADR-0033), без id/FK/меток.
 * Контент — ИЛИ короткий `body` (персональные/системные), ИЛИ `contentFile` —
 * путь к `.md` относительно content/ (рич-релизы, раздаётся бэком под /content/).
 */
export interface NotificationPure {
  /** Вид. */
  kind: NotificationKind;
  /** Заголовок. */
  title: string;
  /** Короткий текст (inline) или null (если рич-контент в файле). */
  body: string | null;
  /** Путь к `.md` относительно content/ или null (если контент в `body`). */
  contentFile: string | null;
}

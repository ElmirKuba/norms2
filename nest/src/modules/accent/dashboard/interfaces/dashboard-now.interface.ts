/** Что дашборд предлагает сделать прямо сейчас (2.11). */
export const DASHBOARD_NOW_KINDS = ['overdue', 'task', 'micro_win', 'all_done'] as const;

/** Вид подсказки «Сейчас». */
export type DashboardNowKind = (typeof DASHBOARD_NOW_KINDS)[number];

/**
 * Герой главного экрана: **одно дело и одна кнопка**, а не список.
 *
 * Считается **по правилам** ([ADR-0063](../../../../../docs/decisions/0063-no-llm-in-critical-path.md)
 * — ИИ в критическом пути нет) из данных, которые уже есть. Чек-ин состояния (2.8) не добавит
 * сюда блок и не поменяет форму: он **уточнит выбор** внутри того же механизма — при низкой
 * энергии первым пойдёт минимум, а не полная задача.
 */
export interface DashboardNow {
  /** Что именно предлагаем. */
  kind: DashboardNowKind;
  /** Название дела или null (для `all_done` — дела нет, экран хвалит). */
  title: string | null;
  /** Задача для действия (`overdue`/`task`) или null. */
  taskId: string | null;
  /** Микро-победа для действия (`micro_win`) или null. */
  microWinId: string | null;
}

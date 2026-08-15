/**
 * Приводит день к человеческому виду: `2026-08-27` → «27 авг».
 *
 * **Строка разбирается вручную, а не через `new Date(iso)`:** тот трактует `YYYY-MM-DD` как UTC,
 * и при отрицательном смещении дата уезжает на сутки назад — ровно тот класс ошибки, ради
 * которого в этой же подфазе чинится часовой пояс.
 *
 * Год добавляется, только если он не текущий: «27 авг» читается быстрее, чем «27 авг 2026», а
 * когда год другой — умолчать о нём нельзя.
 * @param iso День в формате `YYYY-MM-DD`.
 * @returns Короткая подпись или исходная строка, если формат неожиданный.
 */
export function formatDay(iso: string): string {
  const parts = iso.split('-').map(Number);
  const [year, month, day] = parts;
  if (parts.length !== 3 || year === undefined || month === undefined || day === undefined) {
    return iso;
  }
  const date = new Date(year, month - 1, day);
  const label = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date);
  return year === new Date().getFullYear() ? label : `${label} ${String(year)}`;
}

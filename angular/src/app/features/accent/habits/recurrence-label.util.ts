/** RU-сокращения дней недели по кодам RRULE BYDAY. */
const WEEKDAY_RU: Readonly<Record<string, string>> = {
  MO: 'пн',
  TU: 'вт',
  WE: 'ср',
  TH: 'чт',
  FR: 'пт',
  SA: 'сб',
  SU: 'вс',
};

/**
 * Человекочитаемое расписание из RRULE-строки (покрывает пресеты формы: ежедневно /
 * по дням недели / каждые N дней). На незнакомое правило — возвращает исходную строку.
 * @param recurrence RRULE-строка (напр. `FREQ=WEEKLY;BYDAY=MO,WE,FR`).
 * @returns Краткое RU-описание.
 */
export function recurrenceLabel(recurrence: string): string {
  const parts = new Map<string, string>();
  for (const token of recurrence.toUpperCase().split(';')) {
    const [key, value] = token.split('=');
    if (key && value) {
      parts.set(key, value);
    }
  }
  const freq = parts.get('FREQ');
  const interval = Number(parts.get('INTERVAL') ?? '1');

  if (freq === 'WEEKLY' && parts.has('BYDAY')) {
    const days = (parts.get('BYDAY') ?? '')
      .split(',')
      .map((d) => WEEKDAY_RU[d] ?? d.toLowerCase())
      .join(', ');
    return interval > 1 ? `${days} (через ${String(interval)} нед.)` : days;
  }
  if (freq === 'DAILY') {
    return interval > 1 ? `каждые ${String(interval)} дн.` : 'каждый день';
  }
  if (freq === 'WEEKLY') {
    return interval > 1 ? `каждые ${String(interval)} нед.` : 'каждую неделю';
  }
  return recurrence;
}

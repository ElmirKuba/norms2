/** Режим расписания в форме привычки (UI-пресеты RRULE). */
export type RecurrenceMode = 'daily' | 'weekdays' | 'custom-week' | 'every-n';

/** Коды дней недели RRULE (порядок Пн→Вс). */
export const WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;

/** RU-подписи дней недели. */
export const WEEKDAY_LABELS: Readonly<Record<string, string>> = {
  MO: 'Пн',
  TU: 'Вт',
  WE: 'Ср',
  TH: 'Чт',
  FR: 'Пт',
  SA: 'Сб',
  SU: 'Вс',
};

/** Состояние пикера расписания. */
export interface RecurrenceState {
  /** Режим. */
  mode: RecurrenceMode;
  /** Выбранные дни недели (для `custom-week`). */
  weekdays: string[];
  /** Интервал в днях (для `every-n`). */
  intervalN: number;
}

/**
 * Собирает RRULE-строку из состояния пикера.
 * @param state Состояние пикера.
 * @returns RRULE-строка.
 */
export function buildRecurrence(state: RecurrenceState): string {
  switch (state.mode) {
    case 'daily':
      return 'FREQ=DAILY';
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    case 'custom-week': {
      const days = WEEKDAY_CODES.filter((d) => state.weekdays.includes(d));
      const list = days.length > 0 ? days.join(',') : 'MO';
      return `FREQ=WEEKLY;BYDAY=${list}`;
    }
    case 'every-n':
      return `FREQ=DAILY;INTERVAL=${String(Math.max(2, state.intervalN))}`;
  }
}

/**
 * Разбирает RRULE-строку в состояние пикера (обратное `buildRecurrence`); незнакомое → daily.
 * @param recurrence RRULE-строка.
 * @returns Состояние пикера.
 */
export function parseRecurrence(recurrence: string): RecurrenceState {
  const parts = new Map<string, string>();
  for (const token of recurrence.toUpperCase().split(';')) {
    const [key, value] = token.split('=');
    if (key && value) {
      parts.set(key, value);
    }
  }
  const freq = parts.get('FREQ');
  const interval = Number(parts.get('INTERVAL') ?? '1');
  const byday = (parts.get('BYDAY') ?? '').split(',').filter((d) => d.length > 0);

  if (freq === 'WEEKLY' && byday.length > 0) {
    const isWeekdays =
      byday.length === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => byday.includes(d));
    return isWeekdays
      ? { mode: 'weekdays', weekdays: [], intervalN: 1 }
      : { mode: 'custom-week', weekdays: byday, intervalN: 1 };
  }
  if (freq === 'DAILY' && interval > 1) {
    return { mode: 'every-n', weekdays: [], intervalN: interval };
  }
  return { mode: 'daily', weekdays: [], intervalN: 1 };
}

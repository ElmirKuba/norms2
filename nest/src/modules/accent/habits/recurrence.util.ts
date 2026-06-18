import { rrulestr } from 'rrule';

/**
 * Утилиты расписания привычек на базе RRULE (iCalendar, библиотека `rrule`). Привычки
 * date-granular: работаем в «пространстве дат» — каждая локальная дата `YYYY-MM-DD`
 * представляется UTC-полночью, чтобы НЕ возникало tz-сдвигов (вызывающий уже передаёт
 * локальную дату аккаунта). `dtstart` (якорь) нужен для INTERVAL-правил (напр. каждые 2 дня).
 */

/** Локальная дата `YYYY-MM-DD` → Date на UTC-полночь (стабильное «пространство дат»). */
function toUtcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/**
 * Строит правило RRULE с якорем-датой старта.
 * @param recurrence RRULE-строка (напр. `FREQ=WEEKLY;BYDAY=MO,WE,FR`).
 * @param dtstart Якорь `YYYY-MM-DD` (дата старта привычки; влияет на INTERVAL).
 * @returns Объект правила.
 * @throws {Error} Если строка не парсится как RRULE.
 */
function buildRule(recurrence: string, dtstart: string): ReturnType<typeof rrulestr> {
  return rrulestr(recurrence, { dtstart: toUtcMidnight(dtstart) });
}

/**
 * Валидна ли RRULE-строка (парсится и содержит частоту `FREQ`).
 * @param recurrence RRULE-строка.
 * @returns true, если строка — корректное правило.
 */
export function isValidRecurrence(recurrence: string): boolean {
  if (!recurrence.toUpperCase().includes('FREQ=')) {
    return false;
  }
  try {
    buildRule(recurrence, '2000-01-01');
    return true;
  } catch {
    return false;
  }
}

/**
 * Активна ли привычка в указанную локальную дату (есть ли вхождение расписания на этот день).
 * @param recurrence RRULE-строка.
 * @param dtstart Дата старта привычки `YYYY-MM-DD` (якорь для INTERVAL).
 * @param date Целевая локальная дата `YYYY-MM-DD`.
 * @returns true, если на эту дату приходится вхождение.
 */
export function isHabitDueOn(recurrence: string, dtstart: string, date: string): boolean {
  const rule = buildRule(recurrence, dtstart);
  const target = toUtcMidnight(date);
  // Окно ±1 день вокруг цели + сравнение по дате (страховка от ms-сдвигов библиотеки).
  const occurrences = rule.between(
    new Date(target.getTime() - 86_400_000),
    new Date(target.getTime() + 86_400_000),
    true,
  );
  return occurrences.some((occ) => occ.toISOString().slice(0, 10) === date);
}

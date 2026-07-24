/**
 * Форматирование серии «держусь» (общий код списка и детали, C4). Серия считается на фронте
 * вживую из `currentAttemptStartedAt` (unix ms) — сервер лишь отдаёт момент старта.
 */

/** Число миллисекунд в сутках. */
const DAY_MS = 86_400_000;

/** Разбор серии на компоненты дн/ч/мин/сек. */
export interface StreakParts {
  /** Полных дней. */
  days: number;
  /** Часов (0..23). */
  hours: number;
  /** Минут (0..59). */
  minutes: number;
  /** Секунд (0..59). */
  seconds: number;
}

/**
 * Разбивает длительность (now − старт) на дн/ч/мин/сек (не отрицательно).
 * @param startedAtMs Старт попытки (unix ms).
 * @param nowMs Текущий момент (unix ms).
 * @returns Компоненты серии.
 */
export function streakParts(startedAtMs: number, nowMs: number): StreakParts {
  const totalSec = Math.floor(Math.max(0, nowMs - startedAtMs) / 1000);
  return {
    days: Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3_600),
    minutes: Math.floor((totalSec % 3_600) / 60),
    seconds: totalSec % 60,
  };
}

/**
 * Полное число дней серии (для рекорда/снимка).
 * @param startedAtMs Старт попытки (unix ms).
 * @param nowMs Текущий момент (unix ms).
 * @returns Полных дней.
 */
export function streakDays(startedAtMs: number, nowMs: number): number {
  return Math.floor(Math.max(0, nowMs - startedAtMs) / DAY_MS);
}

/** RU-склонение слова «день» по числу. */
export function pluralDays(n: number): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) {
    return 'дней';
  }
  if (mod10 === 1) {
    return 'день';
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return 'дня';
  }
  return 'дней';
}

/** Двузначное дополнение нулём. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Живая подпись серии: «3 дня 04:12:07» (или «04:12:07» при нуле дней).
 * @param p Компоненты серии.
 * @returns Строка для отображения.
 */
export function formatStreakLong(p: StreakParts): string {
  const clock = `${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(p.seconds)}`;
  return p.days > 0 ? `${String(p.days)} ${pluralDays(p.days)} ${clock}` : clock;
}

/**
 * Компактная длительность попытки по мс: «3 дня 4 ч» / «5 ч 12 мин» / «7 мин» / «12 сек».
 * Для рекорда и истории срывов (не тикает).
 * @param ms Длительность в миллисекундах.
 * @returns Строка для отображения.
 */
export function formatDurationCompact(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3_600);
  const minutes = Math.floor((totalSec % 3_600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) {
    return `${String(days)} ${pluralDays(days)}${hours > 0 ? ` ${String(hours)} ч` : ''}`;
  }
  if (hours > 0) {
    return `${String(hours)} ч${minutes > 0 ? ` ${String(minutes)} мин` : ''}`;
  }
  if (minutes > 0) {
    return `${String(minutes)} мин`;
  }
  return `${String(seconds)} сек`;
}

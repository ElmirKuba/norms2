/**
 * Локальная дата произвольного момента в IANA-таймзоне как `YYYY-MM-DD`. Через нативный
 * `Intl` (локаль `en-CA` даёт ISO-подобный формат) — без moment/dayjs. Невалидная зона →
 * откат на UTC (TZ аккаунта валидируется в профиле, но защищаемся).
 * @param date Момент.
 * @param timezone IANA-таймзона (напр. `Europe/Moscow`).
 * @returns Дата в формате `YYYY-MM-DD`.
 */
export function localYmd(date: Date, timezone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', ...options }).format(date);
  }
}

/**
 * Локальная дата «сегодня» в IANA-таймзоне как `YYYY-MM-DD` (ключ дневного лимита).
 * @param timezone IANA-таймзона.
 * @returns Сегодняшняя дата в формате `YYYY-MM-DD`.
 */
export function todayInTimezone(timezone: string): string {
  return localYmd(new Date(), timezone);
}

/**
 * Локальная дата «сегодня» в IANA-таймзоне как `YYYY-MM-DD` (ключ дневного лимита).
 * Через нативный `Intl` (локаль `en-CA` даёт ISO-подобный формат) — без moment/dayjs.
 * Невалидная зона → откат на UTC (TZ аккаунта валидируется в профиле, но защищаемся).
 * @param timezone IANA-таймзона (напр. `Europe/Moscow`).
 * @returns Дата в формате `YYYY-MM-DD`.
 */
export function todayInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}

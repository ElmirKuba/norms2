import type { AntiHabitEventCursor } from '../adapters/accent-anti-habit-event-repository.port';

/**
 * Кодирование keyset-курсора истории событий «держусь» (ADR-0059) в непрозрачную строку и
 * обратно. Курсор — пара `(occurredAt, id)`; наружу отдаём base64url.
 */

/**
 * Кодирует курсор в непрозрачную строку.
 * @param cursor Пара (occurredAt, id).
 * @returns base64url-строка.
 */
export function encodeEventCursor(cursor: AntiHabitEventCursor): string {
  return Buffer.from(`${cursor.occurredAt}:${cursor.id}`, 'utf8').toString('base64url');
}

/**
 * Декодирует курсор из строки; при любой некорректности — null (первая страница).
 * @param raw Строка курсора или undefined.
 * @returns Курсор или null.
 */
export function decodeEventCursor(raw: string | undefined): AntiHabitEventCursor | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const sep = decoded.indexOf(':');
  if (sep <= 0) {
    return null;
  }
  const occurredAt = Number(decoded.slice(0, sep));
  const id = decoded.slice(sep + 1);
  if (!Number.isFinite(occurredAt) || id.length === 0) {
    return null;
  }
  return { occurredAt, id };
}

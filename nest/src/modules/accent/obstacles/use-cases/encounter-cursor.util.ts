import type { EncounterCursor } from '../adapters/accent-obstacle-encounter-repository.port';

/**
 * Кодирование keyset-курсора ленты столкновений в непрозрачную строку и обратно. Курсор —
 * пара `(occurredAt, id)`; наружу отдаём base64url, чтобы клиент не строил его сам.
 */

/**
 * Кодирует курсор в непрозрачную строку.
 * @param cursor Пара (occurredAt, id).
 * @returns base64url-строка.
 */
export function encodeEncounterCursor(cursor: EncounterCursor): string {
  return Buffer.from(`${String(cursor.occurredAt)}:${cursor.id}`, 'utf8').toString('base64url');
}

/**
 * Декодирует курсор; при любой некорректности — null (первая страница), а не ошибка:
 * протухший курсор не должен ломать экран.
 * @param raw Строка курсора или undefined.
 * @returns Курсор или null.
 */
export function decodeEncounterCursor(raw: string | undefined): EncounterCursor | null {
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

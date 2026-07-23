import type { RelapseCursor } from '../adapters/accent-anti-habit-relapse-repository.port';

/**
 * Кодирование keyset-курсора истории рецидивов в непрозрачную строку и обратно. Курсор —
 * пара `(relapseAt, id)`; наружу отдаём base64url, чтобы клиент не парсил внутренности.
 */

/**
 * Кодирует курсор в непрозрачную строку.
 * @param cursor Пара (relapseAt, id).
 * @returns base64url-строка.
 */
export function encodeRelapseCursor(cursor: RelapseCursor): string {
  return Buffer.from(`${cursor.relapseAt}:${cursor.id}`, 'utf8').toString('base64url');
}

/**
 * Декодирует курсор из строки; при любой некорректности — null (первая страница).
 * @param raw Строка курсора или undefined.
 * @returns Курсор или null.
 */
export function decodeRelapseCursor(raw: string | undefined): RelapseCursor | null {
  if (raw === undefined || raw === '') {
    return null;
  }
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const sep = decoded.indexOf(':');
  if (sep <= 0) {
    return null;
  }
  const relapseAt = Number(decoded.slice(0, sep));
  const id = decoded.slice(sep + 1);
  if (!Number.isFinite(relapseAt) || id.length === 0) {
    return null;
  }
  return { relapseAt, id };
}

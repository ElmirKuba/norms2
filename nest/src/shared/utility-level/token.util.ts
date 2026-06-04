import { createHash, randomBytes } from 'node:crypto';

/**
 * Генерирует непредсказуемый opaque-токен (для refresh): 32 случайных байта → hex.
 * @returns 64-символьная hex-строка.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Детерминированный SHA-256 (hex) — ключ поиска токена в БД. Для refresh подходит
 * быстрый хеш (токен высокоэнтропийный, не пользовательский пароль).
 * @param value Исходная строка (токен).
 * @returns SHA-256 в hex.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

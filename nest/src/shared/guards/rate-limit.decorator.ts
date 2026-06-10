import { SetMetadata } from '@nestjs/common';

/** Ключ метаданных лимита. */
export const RATE_LIMIT_KEY = 'rateLimit';

/** Параметры лимита запросов. */
export interface RateLimitOptions {
  /** Максимум запросов в окне. */
  limit: number;
  /** Длина окна (мс). */
  windowMs: number;
}

/**
 * Помечает роут лимитом запросов (anti-brute-force, F5.5). Применяет
 * `RateLimitGuard` (глобальный): запросы сверх лимита с одного IP в окне → 429.
 * @param limit Максимум запросов.
 * @param windowMs Окно в миллисекундах.
 * @returns Декоратор метаданных.
 */
export const RateLimit = (limit: number, windowMs: number): MethodDecorator =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs } satisfies RateLimitOptions);

import { DomainError } from './domain.error';

/**
 * Превышен лимит запросов (anti-brute-force на auth, F5.5) → HTTP 429, машинный
 * код `RATE_LIMITED`.
 */
export class TooManyRequestsError extends DomainError {
  /** Машинный код. */
  public readonly code = 'RATE_LIMITED';
  /** HTTP 429 Too Many Requests. */
  public readonly httpStatus = 429;
}

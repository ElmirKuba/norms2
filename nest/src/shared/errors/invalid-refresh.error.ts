import { DomainError } from './domain.error';

/**
 * Недействительный/истёкший refresh-токен → HTTP 401, машинный код
 * `INVALID_REFRESH`.
 */
export class InvalidRefreshError extends DomainError {
  /** Машинный код. */
  public readonly code = 'INVALID_REFRESH';
  /** HTTP 401 Unauthorized. */
  public readonly httpStatus = 401;
}

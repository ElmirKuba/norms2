import { DomainError } from './domain.error';

/**
 * Квота приглашений исчерпана → HTTP 403, машинный код `QUOTA_EXCEEDED`.
 */
export class QuotaExceededError extends DomainError {
  /** Машинный код. */
  public readonly code = 'QUOTA_EXCEEDED';
  /** HTTP 403 Forbidden. */
  public readonly httpStatus = 403;
}

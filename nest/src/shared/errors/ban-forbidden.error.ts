import { DomainError } from './domain.error';

/**
 * Нет права забанить (цель не в своём поддереве приглашений или это сам себя) →
 * HTTP 403, машинный код `BAN_FORBIDDEN` (ADR-0003).
 */
export class BanForbiddenError extends DomainError {
  /** Машинный код. */
  public readonly code = 'BAN_FORBIDDEN';
  /** HTTP 403 Forbidden. */
  public readonly httpStatus = 403;
}

import { DomainError } from './domain.error';

/**
 * Регистрация только по приглашению (invite-only режим) → HTTP 403,
 * машинный код `INVITE_REQUIRED`.
 */
export class InviteRequiredError extends DomainError {
  /** Машинный код. */
  public readonly code = 'INVITE_REQUIRED';
  /** HTTP 403 Forbidden. */
  public readonly httpStatus = 403;
}

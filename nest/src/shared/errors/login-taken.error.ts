import { DomainError } from './domain.error';

/**
 * Логин уже занят (по lower) → HTTP 409, машинный код `LOGIN_TAKEN`.
 */
export class LoginTakenError extends DomainError {
  /** Машинный код. */
  public readonly code = 'LOGIN_TAKEN';
  /** HTTP 409 Conflict. */
  public readonly httpStatus = 409;
}

import { DomainError } from './domain.error';

/**
 * Аккаунт/профиль не найден (нет логина или soft-deleted) → HTTP 404, машинный
 * код `ACCOUNT_NOT_FOUND`.
 */
export class AccountNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'ACCOUNT_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

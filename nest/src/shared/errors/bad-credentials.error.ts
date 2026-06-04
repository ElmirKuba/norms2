import { DomainError } from './domain.error';

/**
 * Неверные учётные данные / вход запрещён → HTTP 401, машинный код
 * `BAD_CREDENTIALS`. Одинаковый для «нет логина» и «неверный пароль» — не
 * раскрываем, что именно не так.
 */
export class BadCredentialsError extends DomainError {
  /** Машинный код. */
  public readonly code = 'BAD_CREDENTIALS';
  /** HTTP 401 Unauthorized. */
  public readonly httpStatus = 401;
}

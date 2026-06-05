import { DomainError } from './domain.error';

/**
 * Восстановление недоступно: аккаунт не найден, K не задан или вопросов меньше K
 * → HTTP 409, машинный код `RECOVERY_NOT_AVAILABLE`.
 */
export class RecoveryNotAvailableError extends DomainError {
  /** Машинный код. */
  public readonly code = 'RECOVERY_NOT_AVAILABLE';
  /** HTTP 409 Conflict. */
  public readonly httpStatus = 409;
}

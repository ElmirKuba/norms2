import { DomainError } from './domain.error';

/**
 * Восстановление не удалось: неверные ответы / неверный логин / неверное число
 * ответов → HTTP 401, машинный код `RECOVERY_FAILED`. Единый ответ на все причины
 * (не раскрываем, что именно не так — анти-энумерация).
 */
export class RecoveryFailedError extends DomainError {
  /** Машинный код. */
  public readonly code = 'RECOVERY_FAILED';
  /** HTTP 401 Unauthorized. */
  public readonly httpStatus = 401;
}

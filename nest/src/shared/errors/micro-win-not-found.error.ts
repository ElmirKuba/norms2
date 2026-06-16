import { DomainError } from './domain.error';

/**
 * Микро-победа не найдена (нет / не ваша) → HTTP 404, машинный код
 * `MICRO_WIN_NOT_FOUND`. «Не ваша» = «не найдена» (чужие не раскрываем).
 */
export class MicroWinNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'MICRO_WIN_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

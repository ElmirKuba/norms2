import { DomainError } from './domain.error';

/**
 * Запись списка дел не найдена (нет / не ваша) → HTTP 404, машинный код `TODO_NOT_FOUND`.
 * «Не ваша» = «не найдена»: чужие записи не раскрываем даже фактом существования.
 */
export class TodoNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'TODO_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

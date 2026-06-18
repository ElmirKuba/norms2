import { DomainError } from './domain.error';

/**
 * Задача не найдена (нет / не ваша) → HTTP 404, машинный код `TASK_NOT_FOUND`.
 * «Не ваша» = «не найдена» (чужие не раскрываем).
 */
export class TaskNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'TASK_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

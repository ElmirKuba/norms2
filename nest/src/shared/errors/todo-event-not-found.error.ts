import { DomainError } from './domain.error';

/**
 * Событие справочника не найдено (нет / не ваше) → HTTP 404, код `TODO_EVENT_NOT_FOUND`.
 */
export class TodoEventNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'TODO_EVENT_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

import { DomainError } from './domain.error';

/**
 * Цель не найдена (нет / не ваша) → HTTP 404, машинный код `GOAL_NOT_FOUND`.
 * «Не ваша» = «не найдена» (чужие не раскрываем).
 */
export class GoalNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'GOAL_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

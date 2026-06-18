import { DomainError } from './domain.error';

/**
 * Привычка не найдена (нет / не ваша) → HTTP 404, машинный код `HABIT_NOT_FOUND`.
 * «Не ваша» = «не найдена» (чужие не раскрываем).
 */
export class HabitNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'HABIT_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

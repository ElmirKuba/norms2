import { DomainError } from './domain.error';

/**
 * Анти-привычка не найдена (нет / не ваша) → HTTP 404, машинный код `ANTI_HABIT_NOT_FOUND`.
 * «Не ваша» = «не найдена» (чужие не раскрываем).
 */
export class AntiHabitNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'ANTI_HABIT_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

import { DomainError } from './domain.error';

/**
 * Попытка добавить запись прогресса в приостановленную цель (ADR-0052) → HTTP 409,
 * машинный код `GOAL_PAUSED`. На паузе цель не принимает `GoalEntry` и не входит в forecast.
 */
export class GoalPausedError extends DomainError {
  /** Машинный код. */
  public readonly code = 'GOAL_PAUSED';
  /** HTTP 409 Conflict. */
  public readonly httpStatus = 409;
}

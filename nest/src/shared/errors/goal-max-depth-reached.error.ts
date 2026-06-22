import { DomainError } from './domain.error';

/**
 * Превышена максимальная глубина дерева целей (`ACCENT_GOAL_MAX_DEPTH`, ADR-0052) →
 * HTTP 422, машинный код `GOAL_MAX_DEPTH_REACHED`. Нельзя создать подцель глубже лимита.
 */
export class GoalMaxDepthReachedError extends DomainError {
  /** Машинный код. */
  public readonly code = 'GOAL_MAX_DEPTH_REACHED';
  /** HTTP 422 Unprocessable Entity. */
  public readonly httpStatus = 422;
}

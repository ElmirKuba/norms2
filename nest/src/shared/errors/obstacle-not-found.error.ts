import { DomainError } from './domain.error';

/**
 * Препятствие не найдено (нет / не ваше) → HTTP 404, машинный код `OBSTACLE_NOT_FOUND`.
 * «Не ваше» = «не найдено» (чужие не раскрываем).
 */
export class ObstacleNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'OBSTACLE_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

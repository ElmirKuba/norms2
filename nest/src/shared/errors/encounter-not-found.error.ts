import { DomainError } from './domain.error';

/**
 * Запись столкновения не найдена (нет в этом препятствии / чужая) → HTTP 404, машинный код
 * `ENCOUNTER_NOT_FOUND`.
 */
export class EncounterNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'ENCOUNTER_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

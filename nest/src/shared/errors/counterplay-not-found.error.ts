import { DomainError } from './domain.error';

/**
 * Контрмера не найдена (нет в этом препятствии / чужая) → HTTP 404, машинный код
 * `COUNTERPLAY_NOT_FOUND`. «Чужая» = «не найдена» (чужие не раскрываем).
 */
export class CounterplayNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'COUNTERPLAY_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

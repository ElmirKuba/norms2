import { DomainError } from './domain.error';

/**
 * Неизвестная IANA-зона → HTTP 422, код `TIMEZONE_INVALID`.
 *
 * 422, а не 400: тело запроса корректно по форме, не проходит проверка по существу — так же, как
 * у предела глубины дерева.
 */
export class TimezoneInvalidError extends DomainError {
  /** Машинный код. */
  public readonly code = 'TIMEZONE_INVALID';
  /** HTTP 422 Unprocessable Entity. */
  public readonly httpStatus = 422;
}

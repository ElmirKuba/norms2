import { DomainError } from './domain.error';

/**
 * Ошибка валидации доменного значения (Value Object и пр.) → HTTP 400,
 * машинный код `VALIDATION_ERROR`.
 */
export class ValidationError extends DomainError {
  /** Машинный код. */
  public readonly code = 'VALIDATION_ERROR';
  /** HTTP 400 Bad Request. */
  public readonly httpStatus = 400;
}

import { DomainError } from './domain.error';

/**
 * Недопустимое K (recovery_required_count): нужно `1 ≤ K ≤ N` (N — число
 * настроенных вопросов) → HTTP 422, машинный код `RECOVERY_REQUIRED_COUNT_INVALID`.
 */
export class RecoveryRequiredCountInvalidError extends DomainError {
  /** Машинный код. */
  public readonly code = 'RECOVERY_REQUIRED_COUNT_INVALID';
  /** HTTP 422 Unprocessable Entity. */
  public readonly httpStatus = 422;
}

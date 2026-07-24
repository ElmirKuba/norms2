import { DomainError } from './domain.error';

/**
 * Дата старта/переноса «держусь» должна быть в БУДУЩЕМ (бэкфилл в прошлое не поддерживается,
 * ADR-0059; «создай новую, старую удали»). → HTTP 400, машинный код `INVALID_START_DATE`.
 */
export class InvalidStartDateError extends DomainError {
  /** Машинный код. */
  public readonly code = 'INVALID_START_DATE';
  /** HTTP 400 Bad Request. */
  public readonly httpStatus = 400;
}

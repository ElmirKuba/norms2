import { DomainError } from './domain.error';

/**
 * Срыв нельзя записать: нет активной попытки (анти-привычка неактивна) либо повторный
 * срыв в тот же момент — конкурентный `relapse` уже сбросил таймер (CAS-гонка, ADR-0035;
 * domain-model §7). → HTTP 409, машинный код `ALREADY_RELAPSED`.
 */
export class AlreadyRelapsedError extends DomainError {
  /** Машинный код. */
  public readonly code = 'ALREADY_RELAPSED';
  /** HTTP 409 Conflict. */
  public readonly httpStatus = 409;
}

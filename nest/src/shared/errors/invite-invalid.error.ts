import { DomainError } from './domain.error';

/**
 * Недействительный код приглашения (нет / истёк / уже использован / не ваш) →
 * HTTP 400, машинный код `INVITE_INVALID`. «Не ваш» = «не найден» (не раскрываем
 * чужие коды).
 */
export class InviteInvalidError extends DomainError {
  /** Машинный код. */
  public readonly code = 'INVITE_INVALID';
  /** HTTP 400 Bad Request. */
  public readonly httpStatus = 400;
}

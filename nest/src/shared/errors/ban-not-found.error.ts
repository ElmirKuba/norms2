import { DomainError } from './domain.error';

/**
 * Бан не найден при снятии (нет записи / не ваша / уже снята) → HTTP 404,
 * машинный код `BAN_NOT_FOUND`. «Не ваш» = «не найден» (не раскрываем чужие баны).
 */
export class BanNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'BAN_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

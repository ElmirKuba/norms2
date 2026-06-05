import { DomainError } from './domain.error';

/**
 * Сессия не найдена при отзыве (нет / не своя / уже отозвана) → HTTP 404, машинный
 * код `SESSION_NOT_FOUND`. «Не своя» = «не найдена» (не раскрываем чужие сессии).
 */
export class SessionNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'SESSION_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

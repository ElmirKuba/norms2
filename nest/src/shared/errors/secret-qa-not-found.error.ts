import { DomainError } from './domain.error';

/**
 * Секретный вопрос не найден при удалении (нет / не ваш) → HTTP 404, машинный код
 * `SECRET_QA_NOT_FOUND`. «Не ваш» = «не найден» (не раскрываем чужие вопросы).
 */
export class SecretQaNotFoundError extends DomainError {
  /** Машинный код. */
  public readonly code = 'SECRET_QA_NOT_FOUND';
  /** HTTP 404 Not Found. */
  public readonly httpStatus = 404;
}

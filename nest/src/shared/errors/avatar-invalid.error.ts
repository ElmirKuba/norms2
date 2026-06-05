import { DomainError } from './domain.error';

/**
 * Невалидная аватарка (нет файла / неподдерживаемый тип / превышен размер) →
 * HTTP 400, машинный код `AVATAR_INVALID`.
 */
export class AvatarInvalidError extends DomainError {
  /** Машинный код. */
  public readonly code = 'AVATAR_INVALID';
  /** HTTP 400 Bad Request. */
  public readonly httpStatus = 400;
}

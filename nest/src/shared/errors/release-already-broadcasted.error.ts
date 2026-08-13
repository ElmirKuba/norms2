import { DomainError } from './domain.error';

/**
 * Релиз уже объявлен в канал → HTTP 409, код `ALREADY_BROADCASTED`.
 *
 * Защита от двойного клика: канал не должен получать один и тот же пост дважды, а удалять свои
 * посты бот не умеет — исправлять пришлось бы руками в Telegram.
 */
export class ReleaseAlreadyBroadcastedError extends DomainError {
  /** Машинный код. */
  public readonly code = 'ALREADY_BROADCASTED';
  /** HTTP 409 Conflict. */
  public readonly httpStatus = 409;
}

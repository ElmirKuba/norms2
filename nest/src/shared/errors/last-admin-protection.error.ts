import { DomainError } from './domain.error';

/**
 * Попытка снять роль администратора с самого себя → HTTP 409, код `LAST_ADMIN_PROTECTION`.
 *
 * Заведена вместо `ConflictException` с телом-конвертом: глобальный фильтр собирает конверт сам
 * и достаёт `code` **только** из `DomainError`. Брошенный `ConflictException({error:{code}})`
 * выглядел правильно, но наружу уходил обезличенным `CONFLICT` — то есть контракт обещал код,
 * которого клиент никогда не видел.
 */
export class LastAdminProtectionError extends DomainError {
  /** Машинный код. */
  public readonly code = 'LAST_ADMIN_PROTECTION';
  /** HTTP 409 Conflict. */
  public readonly httpStatus = 409;
}

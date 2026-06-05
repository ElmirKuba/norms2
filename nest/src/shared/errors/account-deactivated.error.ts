import { DomainError } from './domain.error';

/**
 * Вход с верными данными, но аккаунт деактивирован (обратимая пауза, ADR-0017) →
 * HTTP 403, машинный код `ACCOUNT_DEACTIVATED`. Сигнал фронту предложить
 * реактивацию (`POST /auth/reactivate`). Раскрытие состояния безопасно — только
 * при верных учётных данных (владельцу).
 */
export class AccountDeactivatedError extends DomainError {
  /** Машинный код. */
  public readonly code = 'ACCOUNT_DEACTIVATED';
  /** HTTP 403 Forbidden. */
  public readonly httpStatus = 403;
}

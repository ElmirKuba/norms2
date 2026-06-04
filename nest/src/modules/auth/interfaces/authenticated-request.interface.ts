import type { Request } from 'express';
import type { AccountFull } from '../../account/interfaces/account-full.interface';

/**
 * Express-запрос после `AuthGuard`: содержит аутентифицированный аккаунт.
 * Контроллеры защищённых роутов читают `request.account` (или через декоратор).
 */
export interface AuthenticatedRequest extends Request {
  /** Аккаунт, установленный Guard'ом из access-токена. */
  account: AccountFull;
}

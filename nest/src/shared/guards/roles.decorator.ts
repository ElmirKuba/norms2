import { SetMetadata } from '@nestjs/common';

/** Ключ метаданных требуемых ролей. */
export const ROLES_KEY = 'requiredRoles';

/**
 * Помечает роут требуемыми ролями (2.9.3·3). Применяет `RolesGuard`.
 *
 * **Достаточно ОДНОЙ из перечисленных** («или», не «и»): роли у нас складываются, а не
 * вкладываются друг в друга — человек может быть одновременно пользователем и админом.
 *
 * ⚠️ **Работает только после `AuthGuard`**: роли берутся у аккаунта из `request.account`.
 * На публичном роуте декоратор смысла не имеет — там некого проверять.
 *
 * @param roles Коды ролей (`admin`), сверяются без учёта регистра.
 * @returns Декоратор метаданных.
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

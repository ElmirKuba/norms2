import { CanActivate, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { ROLE_REPOSITORY } from '../../modules/account/adapters/role-repository.port';
import type { RoleRepositoryPort } from '../../modules/account/adapters/role-repository.port';
import type { AuthenticatedRequest } from '../../modules/auth/interfaces/authenticated-request.interface';

/**
 * Проверка ролей на роуте (2.9.3·3). Ставится ПОСЛЕ `AuthGuard` — роли берутся у аккаунта,
 * который тот положил в `request.account`.
 *
 * **Отказ — 404, а не 403** (реш. Elmir 10.08.2026). 403 подтверждает, что ручка существует:
 * достаточно перебрать адреса, и карта админки готова, даже если ни одна не откроется. 404
 * не сообщает ничего — для постороннего админских ручек просто нет. Цена: свой же админ,
 * потерявший роль, увидит «не найдено» вместо «нет прав»; в журнале (·6) причина будет видна.
 *
 * **Роль читается из базы на каждом запросе, а не из токена.** Иначе сняли админа — а он
 * остаётся админом до истечения access-токена. Права должны отниматься сразу; лишний запрос
 * к базе на админских ручках — приемлемая цена (их мало и они редкие).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  /**
   * @param _reflector Чтение метаданных роута.
   * @param _roleRepository Порт репозитория ролей.
   */
  public constructor(
    private readonly _reflector: Reflector,
    @Inject(ROLE_REPOSITORY) private readonly _roleRepository: RoleRepositoryPort,
  ) {}

  /**
   * Пропускает запрос, если у аккаунта есть хотя бы одна из требуемых ролей.
   * @param context Контекст выполнения.
   * @returns true, если доступ разрешён.
   * @throws {NotFoundException} Если ролей не хватает или аккаунта в запросе нет.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this._reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Роут без декоратора ролей не наше дело.
    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const account = request.account;
    if (account === undefined) {
      // Роль требуется, а аутентификации не было: скорее всего забыли AuthGuard. Наружу — то
      // же 404, что и при нехватке прав: разница видна в коде, но не постороннему.
      throw new NotFoundException();
    }

    const codes = await this._roleRepository.codesOf(account.id);
    const allowed = required.some((role) => codes.includes(role.toLowerCase()));
    if (!allowed) {
      throw new NotFoundException();
    }
    return true;
  }
}

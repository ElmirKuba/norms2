import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from '../adapters/account-repository.port';
import type { AccountRepositoryPort } from '../adapters/account-repository.port';
import { ROLE_REPOSITORY } from '../adapters/role-repository.port';
import type { RoleRepositoryPort } from '../adapters/role-repository.port';
import { ROLE_USER, ROLES_SEED } from './roles.seed';
import {
  AUDIT_ACTIONS,
  AuditDomainService,
} from '../../audit/domain-services/audit.domain-service';

/**
 * Сид ролей (2.9.3·2).
 *
 * Делает на старте две вещи, обе идемпотентно:
 * 1. **заводит справочник** ролей из {@link ROLES_SEED};
 * 2. **досыпает базовую роль** `user` тем аккаунтам, у кого её ещё нет — это разовая догонялка
 *    для тех, кто зарегистрировался до появления ролей;
 *
 * **Администраторов здесь НЕТ намеренно** (реш. Elmir 12.08.2026). Раньше первый админ
 * назначался списком логинов в `ADMIN_LOGINS`, то есть конкретное имя жило в конфиге открытого
 * проекта. Теперь роль выдаёт тот, кто разворачивает, — скриптом
 * [`scripts/grant-admin.sh`](../../../../../scripts/grant-admin.sh) (или `.cmd` на Windows):
 * он спрашивает логин у запускающего, и в репозитории не остаётся ничьих имён.
 *
 * ⚠️ **Роли только выдаются, никогда не снимаются.** Снятие роли — осознанное действие админки,
 * а не побочный эффект перезапуска или правки конфига.
 */
@Injectable()
export class RoleSeedService implements OnApplicationBootstrap {
  private readonly _logger = new Logger(RoleSeedService.name);

  /**
   * @param _roleRepository Порт репозитория ролей.
   * @param _accountRepository Порт репозитория аккаунтов (поиск по логину).
   * @param _audit Журнал действий (2.9.3·6).
   */
  public constructor(
    @Inject(ROLE_REPOSITORY) private readonly _roleRepository: RoleRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly _accountRepository: AccountRepositoryPort,
    private readonly _audit: AuditDomainService,
  ) {}

  /**
   * Прогоняет сид ролей после полной инициализации приложения.
   * @returns Промис завершения.
   */
  public async onApplicationBootstrap(): Promise<void> {
    try {
      for (const role of ROLES_SEED) {
        await this._roleRepository.ensureRole(role);
      }
      await this._backfillUserRole();
    } catch (error) {
      // Сид ролей не должен ронять приложение: продукт работает и без админки.
      this._logger.error(`Сид ролей сорвался: ${String(error)}`);
    }
  }

  /** Досыпает базовую роль тем, у кого её ещё нет. */
  private async _backfillUserRole(): Promise<void> {
    const role = await this._roleRepository.findByCode(ROLE_USER);
    if (role === null) {
      return;
    }
    const accountIds = await this._roleRepository.accountsWithoutRole(role.id);
    for (const accountId of accountIds) {
      await this._roleRepository.grant(accountId, role.id);
    }
    if (accountIds.length > 0) {
      this._logger.log(`Базовая роль выдана аккаунтам: ${accountIds.length}`);
      // Одной записью на прогон, а не строкой на аккаунт: это разовая догонялка для тех, кто
      // зарегистрировался до появления ролей, и двадцать одинаковых строк только забьют журнал.
      await this._audit.record({
        action: AUDIT_ACTIONS.ROLE_BACKFILLED,
        targetType: 'role',
        targetId: ROLE_USER,
        targetLabel: ROLE_USER,
        details: { count: accountIds.length },
      });
    }
  }

}

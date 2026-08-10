import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCOUNT_REPOSITORY } from '../adapters/account-repository.port';
import type { AccountRepositoryPort } from '../adapters/account-repository.port';
import { ROLE_REPOSITORY } from '../adapters/role-repository.port';
import type { RoleRepositoryPort } from '../adapters/role-repository.port';
import { ROLE_ADMIN, ROLE_USER, ROLES_SEED } from './roles.seed';
import type { Env } from '../../../system/config/env.schema';

/**
 * Сид ролей и назначение администраторов (2.9.3·2).
 *
 * Делает на старте три вещи, все идемпотентно:
 * 1. **заводит справочник** ролей из {@link ROLES_SEED};
 * 2. **досыпает базовую роль** `user` тем аккаунтам, у кого её ещё нет — это разовая догонялка
 *    для тех, кто зарегистрировался до появления ролей;
 * 3. **выдаёт `admin`** аккаунтам, чьи логины перечислены в `ADMIN_LOGINS`.
 *
 * **Почему администраторы задаются окружением** (реш. Claude 10.08.2026, поручено Elmir):
 * назначение воспроизводится на любом стенде, не требует ssh и правки базы руками — ровно того,
 * от чего уходит вся эта подфаза. По умолчанию список пуст, поэтому случайных админов не бывает.
 *
 * ⚠️ **Роли только выдаются, никогда не снимаются.** Убрали логин из `ADMIN_LOGINS` — права у
 * человека остаются: снятие роли это осознанное действие админки (·5), а не побочный эффект
 * правки переменной. Иначе опечатка в `.env` молча разжаловала бы администратора.
 *
 * **Отсутствие аккаунта — не ошибка.** Логин может быть вписан заранее, до регистрации: тогда
 * говорим вслух и пробуем на следующем старте.
 */
@Injectable()
export class RoleSeedService implements OnApplicationBootstrap {
  private readonly _logger = new Logger(RoleSeedService.name);

  /**
   * @param _roleRepository Порт репозитория ролей.
   * @param _accountRepository Порт репозитория аккаунтов (поиск по логину).
   * @param _configService Конфиг (`ADMIN_LOGINS`).
   */
  public constructor(
    @Inject(ROLE_REPOSITORY) private readonly _roleRepository: RoleRepositoryPort,
    @Inject(ACCOUNT_REPOSITORY) private readonly _accountRepository: AccountRepositoryPort,
    private readonly _configService: ConfigService<Env, true>,
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
      await this._grantAdmins();
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
    }
  }

  /** Выдаёт `admin` логинам из `ADMIN_LOGINS`. */
  private async _grantAdmins(): Promise<void> {
    const raw = this._configService.get('ADMIN_LOGINS', { infer: true });
    const logins = raw
      .split(',')
      .map((login) => login.trim())
      .filter((login) => login !== '');
    if (logins.length === 0) {
      return;
    }
    const role = await this._roleRepository.findByCode(ROLE_ADMIN);
    if (role === null) {
      return;
    }
    for (const login of logins) {
      const account = await this._accountRepository.findByLoginNormalized(login.toLowerCase());
      if (account === null) {
        this._logger.warn(`ADMIN_LOGINS: аккаунт '${login}' не найден — роль не выдана.`);
        continue;
      }
      const granted = await this._roleRepository.grant(account.id, role.id);
      if (granted) {
        this._logger.log(`Роль администратора выдана: '${login}'.`);
      }
    }
  }
}

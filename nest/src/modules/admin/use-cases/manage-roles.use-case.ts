import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LastAdminProtectionError } from '../../../shared/errors/last-admin-protection.error';
import { ROLE_REPOSITORY } from '../../account/adapters/role-repository.port';
import type { RoleRepositoryPort } from '../../account/adapters/role-repository.port';
import {
  AUDIT_ACTIONS,
  AuditDomainService,
} from '../../audit/domain-services/audit.domain-service';
import type { AdminAccountPage } from '../interfaces/admin-account-page.interface';
import type { AdminAccountView } from '../interfaces/admin-account-view.interface';

/** Код роли администратора. */
const ROLE_ADMIN = 'admin';
/** Размер страницы по умолчанию и потолок — чтобы `limit=100000` не выгружал всю базу. */
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/** Кто совершает действие: нужен и для запрета «разжаловать себя», и для журнала. */
export interface RoleActor {
  /** Аккаунт админа. */
  accountId: string;
  /** Логин админа — снимком в журнал. */
  login: string;
}

/**
 * Люди и их роли в админке (2.9.3·10).
 *
 * Кросс-домен идёт вниз: use-case админки зовёт репозиторий ролей области `account` через её
 * порт, но не её use-cases — круговой DI поэтому невозможен.
 */
@Injectable()
export class ManageRolesUseCase {
  /**
   * @param _roleRepository Порт репозитория ролей.
   * @param _audit Журнал действий.
   */
  public constructor(
    @Inject(ROLE_REPOSITORY) private readonly _roleRepository: RoleRepositoryPort,
    private readonly _audit: AuditDomainService,
  ) {}

  /**
   * Страница людей с ролями.
   * @param query Подстрока логина или псевдонима.
   * @param limit Размер страницы.
   * @param cursor Курсор предыдущей страницы.
   * @returns Строки и курсор следующей страницы.
   */
  public async list(query: string, limit: number, cursor: string | null): Promise<AdminAccountPage> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    return this._roleRepository.listWithRoles({ query: query.trim(), limit: safeLimit, cursor });
  }

  /**
   * Выдаёт роль аккаунту. Идемпотентно.
   * @param accountId Кому.
   * @param code Код роли.
   * @param actor Кто выдаёт.
   * @returns Обновлённая строка человека.
   * @throws {NotFoundException} Если роли с таким кодом нет.
   */
  public async grant(accountId: string, code: string, actor: RoleActor): Promise<AdminAccountView> {
    const role = await this._requireRole(code);
    const granted = await this._roleRepository.grant(accountId, role.id);
    const account = await this._requireAccount(accountId);
    if (granted) {
      await this._writeLog(AUDIT_ACTIONS.ROLE_GRANTED, account, role.code, actor);
    }
    return account;
  }

  /**
   * Снимает роль с аккаунта. Идемпотентно.
   *
   * ⛔ **Снять `admin` с самого себя нельзя.** Это не забота о самолюбии: аварийного люка в
   * продукте нет осознанно (·3а), и админ, разжаловавший себя, чинится только скриптом на
   * сервере. Побочно этот же запрет гарантирует, что **хотя бы один админ останется всегда**:
   * последнему просто некого разжаловать, кроме себя.
   *
   * @param accountId У кого.
   * @param code Код роли.
   * @param actor Кто снимает.
   * @returns Обновлённая строка человека.
   * @throws {NotFoundException} Если роли с таким кодом нет.
   * @throws {LastAdminProtectionError} При попытке снять `admin` с себя (409).
   */
  public async revoke(accountId: string, code: string, actor: RoleActor): Promise<AdminAccountView> {
    const role = await this._requireRole(code);
    if (role.code.toLowerCase() === ROLE_ADMIN && accountId === actor.accountId) {
      throw new LastAdminProtectionError('Снять роль администратора с самого себя нельзя.');
    }
    const revoked = await this._roleRepository.revoke(accountId, role.id);
    const account = await this._requireAccount(accountId);
    if (revoked) {
      await this._writeLog(AUDIT_ACTIONS.ROLE_REVOKED, account, role.code, actor);
    }
    return account;
  }

  /**
   * Находит роль по коду или отказывает.
   * @param code Код роли.
   * @returns Строка справочника.
   */
  private async _requireRole(code: string): Promise<{ id: string; code: string }> {
    const role = await this._roleRepository.findByCode(code);
    if (role === null) {
      throw new NotFoundException();
    }
    return role;
  }

  /**
   * Перечитывает строку человека после изменения — чтобы экран получил правду из базы, а не
   * собранную на клиенте догадку.
   * @param accountId Кого.
   * @returns Строка человека.
   * @throws {NotFoundException} Если аккаунта нет.
   */
  private async _requireAccount(accountId: string): Promise<AdminAccountView> {
    const row = await this._roleRepository.findWithRoles(accountId);
    if (row === null) {
      throw new NotFoundException();
    }
    return row;
  }

  /**
   * Пишет событие смены прав в журнал.
   *
   * **Логин цели идёт снимком в `targetLabel`** — как и логин действовавшего. Без него запись
   * «над кем» читается голым PK: журнал ролей — как раз тот экран, который открывают, чтобы
   * понять, кому и когда дали права, и join за именем там делать не с чем (аккаунт могли
   * удалить, ссылка обнулится).
   *
   * @param action Код действия.
   * @param account Над кем — уже перечитанная строка человека.
   * @param roleCode Какая роль.
   * @param actor Кто действовал.
   * @returns Промис завершения.
   */
  private async _writeLog(
    action: string,
    account: AdminAccountView,
    roleCode: string,
    actor: RoleActor,
  ): Promise<void> {
    await this._audit.record({
      action,
      actorAccountId: actor.accountId,
      actorLogin: actor.login,
      targetType: 'account',
      targetId: account.id,
      targetLabel: account.login,
      details: { role: roleCode.toLowerCase() },
    });
  }
}

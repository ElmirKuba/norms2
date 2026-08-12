import { Inject, Injectable } from '@nestjs/common';
import { eq, notExists, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { accounts } from '../../schemas/accounts.schema';
import { accountRoles } from '../../schemas/account-roles.schema';
import { roles } from '../../schemas/roles.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { Transaction } from '../../../shared/transactions/transaction.interface';
import type { DrizzleExecutor } from '../../client/database.constants';
import type { RoleRepositoryPort } from '../../../modules/account/adapters/role-repository.port';
import type { RoleFull } from '../../../modules/account/interfaces/role-full.interface';

/**
 * Drizzle-реализация порта ролей (2.9.3).
 *
 * **Идемпотентность делает база, а не код.** Уникальные индексы (`lower(code)` в справочнике и
 * пара account+role в связи) позволяют писать `on conflict do nothing` вместо «сначала проверь,
 * потом вставь»: последнее гонку не переживает — два старта подряд создали бы дубли.
 */
@Injectable()
export class RoleRepository implements RoleRepositoryPort {
  /**
   * @param _database Клиент Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _database: DrizzleDatabase) {}

  /**
   * Заводит роль, если её ещё нет.
   * @param role Код, название и описание.
   * @returns Строка справочника.
   */
  public async ensureRole(role: {
    code: string;
    title: string;
    description: string | null;
  }): Promise<RoleFull> {
    await this._database
      .insert(roles)
      .values({ id: generateId(), ...role })
      .onConflictDoNothing();
    const found = await this.findByCode(role.code);
    if (found === null) {
      // Сюда попасть нельзя: вставка выше либо создала строку, либо наткнулась на существующую.
      throw new Error(`Роль '${role.code}' не найдена сразу после создания`);
    }
    return found;
  }

  /**
   * Находит роль по коду без учёта регистра.
   * @param code Код роли.
   * @returns Строка справочника или null.
   */
  public async findByCode(code: string): Promise<RoleFull | null> {
    const [row] = await this._database
      .select()
      .from(roles)
      .where(sql`lower(${roles.code}) = lower(${code})`)
      .limit(1);
    return row ?? null;
  }

  /**
   * Выдаёт роль аккаунту.
   * @param accountId Кому.
   * @param roleId Какую.
   * @returns true, если роль выдана именно сейчас.
   */
  public async grant(accountId: string, roleId: string, tx?: Transaction): Promise<boolean> {
    const granted = await this._exec(tx)
      .insert(accountRoles)
      .values({ id: generateId(), accountId, roleId })
      .onConflictDoNothing()
      .returning({ id: accountRoles.id });
    return granted.length > 0;
  }

  /**
   * Коды ролей аккаунта.
   * @param accountId Чьи роли.
   * @returns Коды в нижнем регистре.
   */
  public async codesOf(accountId: string): Promise<string[]> {
    const rows = await this._database
      .select({ code: roles.code })
      .from(accountRoles)
      .innerJoin(roles, eq(roles.id, accountRoles.roleId))
      .where(eq(accountRoles.accountId, accountId));
    return rows.map((row) => row.code.toLowerCase());
  }

  /**
   * Аккаунты без указанной роли.
   * @param roleId Роль, которой не хватает.
   * @returns Идентификаторы аккаунтов.
   */
  /**
   * Аккаунты с указанной ролью по её коду (2.9.3·3а).
   * @param code Код роли, регистр не важен.
   * @returns Идентификаторы аккаунтов.
   */
  public async accountIdsByRoleCode(code: string): Promise<string[]> {
    const rows = await this._database
      .select({ id: accountRoles.accountId })
      .from(accountRoles)
      .innerJoin(roles, eq(roles.id, accountRoles.roleId))
      .where(sql`lower(${roles.code}) = ${code.toLowerCase()}`);
    return rows.map((row) => row.id);
  }

  public async accountsWithoutRole(roleId: string): Promise<string[]> {
    const rows = await this._database
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        notExists(
          this._database
            .select({ one: sql`1` })
            .from(accountRoles)
            .where(
              sql`${accountRoles.accountId} = ${accounts.id} and ${accountRoles.roleId} = ${roleId}`,
            ),
        ),
      );
    return rows.map((row) => row.id);
  }

  /**
   * Разрешает исполнителя: переданная транзакция или дефолтный инстанс БД.
   * @param tx Опц. опаковая транзакция.
   * @returns DrizzleExecutor.
   */
  private _exec(tx?: Transaction): DrizzleExecutor {
    return tx === undefined ? this._database : (tx as unknown as DrizzleExecutor);
  }
}

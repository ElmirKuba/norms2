import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, notExists, sql } from 'drizzle-orm';
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
import type { AdminAccountPage } from '../../../modules/admin/interfaces/admin-account-page.interface';
import type { AdminAccountView } from '../../../modules/admin/interfaces/admin-account-view.interface';
import { bans } from '../../schemas/bans.schema';

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
   * Снимает роль с аккаунта (2.9.3·10).
   * @param accountId У кого.
   * @param roleId Какую.
   * @returns true, если роль была снята именно сейчас.
   */
  public async revoke(accountId: string, roleId: string): Promise<boolean> {
    const removed = await this._database
      .delete(accountRoles)
      .where(and(eq(accountRoles.accountId, accountId), eq(accountRoles.roleId, roleId)))
      .returning({ id: accountRoles.id });
    return removed.length > 0;
  }

  /**
   * Страница людей с ролями (2.9.3·10).
   *
   * Роли собираются подзапросом в массив, а не join-ом со схлопыванием на приложении: иначе
   * лимит страницы считался бы по СТРОКАМ связи, и человек с двумя ролями съедал бы две позиции.
   *
   * Порядок — по `id` убыванием: он начинается с uuidv7, то есть монотонен по времени
   * регистрации, и годится и как сортировка, и как курсор.
   *
   * @param params Поиск, размер страницы и курсор.
   * @returns Строки и курсор следующей страницы.
   */
  public async listWithRoles(params: {
    query: string;
    limit: number;
    cursor: string | null;
  }): Promise<AdminAccountPage> {
    const { query, limit, cursor } = params;
    const conditions = [];
    if (query !== '') {
      const pattern = `%${query.toLowerCase()}%`;
      conditions.push(
        sql`(lower(${accounts.login}) like ${pattern} or lower(${accounts.alias}) like ${pattern})`,
      );
    }
    if (cursor !== null) {
      conditions.push(sql`${accounts.id} < ${cursor}`);
    }

    // Просим на одну строку больше запрошенного: наличие «лишней» и есть ответ на вопрос,
    // существует ли следующая страница. Отдельный count тут был бы вторым запросом ради того,
    // что и так видно.
    const rows = await this._database
      .select(this._adminColumns())
      .from(accounts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(accounts.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  /**
   * Один человек с ролями (2.9.3·10).
   * @param accountId Кого.
   * @returns Строка или null.
   */
  public async findWithRoles(accountId: string): Promise<AdminAccountView | null> {
    const [row] = await this._database
      .select(this._adminColumns())
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Набор колонок проекции админки — общий для страницы и точечного чтения, чтобы две выборки
   * не разъехались по составу полей.
   * @returns Описание колонок для select.
   */
  private _adminColumns() {
    // Ссылка на внешнюю колонку — через `sql.raw` с явным именем таблицы. Drizzle рендерит
    // `${accounts.id}` без квалификатора, и внутри подзапроса `"id"` разрешается в его
    // собственную область — коррелированный запрос молча превращается в бессмысленный.
    return {
      id: accounts.id,
      login: accounts.login,
      alias: accounts.alias,
      registrationSource: accounts.registrationSource,
      invitesRemaining: accounts.invitesRemaining,
      deactivatedAt: accounts.deactivatedAt,
      deletedAt: accounts.deletedAt,
      createdAt: accounts.createdAt,
      roles: sql<string[]>`coalesce((
        select array_agg(lower(r.code) order by lower(r.code))
          from ${accountRoles} ar
          join ${roles} r on r.id = ar.role_id
         where ar.account_id = ${sql.raw('"accounts"."id"')}
      ), '{}')`,
      // Забанен ли человек прямо сейчас (2.9.3·26). Без этого админка показывала бы «Забанить»
      // тому, кто уже забанен, и не давала бы снять бан — а снять его иногда некому: банивший
      // мог удалиться, а ветка выше молчать ([ADR-0003, дополнение]).
      banned: sql<boolean>`exists (
        select 1 from ${bans} b
         where b.target_id = ${sql.raw('"accounts"."id"')} and b.active
      )`,
    };
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

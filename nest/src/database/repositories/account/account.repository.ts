import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase, DrizzleExecutor } from '../../client/database.constants';
import { accounts } from '../../schemas/accounts.schema';
import type { AccountRepositoryPort } from '../../../modules/account/adapters/account-repository.port';
import type { AccountCreate } from '../../../modules/account/interfaces/account-create.interface';
import type { AccountFull } from '../../../modules/account/interfaces/account-full.interface';
import type { AccountMutable } from '../../../modules/account/interfaces/account-mutable.interface';
import type { Transaction } from '../../../shared/transactions/transaction.interface';

/**
 * Drizzle-реализация порта аккаунтов (единственное место, где про ORM знают).
 * Маппит строку БД в доменный AccountFull. CAS по version (ADR-0035), атомарные
 * счётчики квоты. Биндится на токен ACCOUNT_REPOSITORY в account.module.
 */
@Injectable()
export class AccountRepository implements AccountRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Находит аккаунт по PK.
   * @param id Идентификатор.
   * @returns Полная строка или null.
   */
  public async findById(id: string): Promise<AccountFull | null> {
    const rows = await this._db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
    const row = rows[0];
    return row ? this._toFull(row) : null;
  }

  /**
   * Находит аккаунт по нормализованному (lower) логину.
   * @param loginNormalized Логин в нижнем регистре.
   * @returns Полная строка или null.
   */
  public async findByLoginNormalized(loginNormalized: string): Promise<AccountFull | null> {
    const rows = await this._db
      .select()
      .from(accounts)
      .where(sql`lower(${accounts.login}) = ${loginNormalized}`)
      .limit(1);
    const row = rows[0];
    return row ? this._toFull(row) : null;
  }

  /**
   * Проверяет занятость логина (по lower).
   * @param loginNormalized Логин в нижнем регистре.
   * @returns true, если занят.
   */
  public async existsByLoginNormalized(loginNormalized: string): Promise<boolean> {
    const rows = await this._db
      .select({ id: accounts.id })
      .from(accounts)
      .where(sql`lower(${accounts.login}) = ${loginNormalized}`)
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Создаёт аккаунт.
   * @param id Идентификатор (генерит домен).
   * @param data Данные создания (Base).
   * @param tx Опц. транзакция (атомарность с погашением инвайта при регистрации).
   * @returns Созданная полная строка.
   * @throws {Error} Если INSERT не вернул строку.
   */
  public async create(id: string, data: AccountCreate, tx?: Transaction): Promise<AccountFull> {
    const rows = await this._exec(tx)
      .insert(accounts)
      .values({ id, ...data })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT accounts не вернул строку.');
    }
    return this._toFull(row);
  }

  /**
   * Optimistic-lock обновление по version (CAS, ADR-0035).
   * @param id Идентификатор.
   * @param expectedVersion Ожидаемая версия.
   * @param changes Изменяемые поля.
   * @returns Обновлённая строка или null при конфликте версий.
   */
  public async updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: AccountMutable,
  ): Promise<AccountFull | null> {
    const rows = await this._db
      .update(accounts)
      .set({ ...changes, version: sql`${accounts.version} + 1` })
      .where(and(eq(accounts.id, id), eq(accounts.version, expectedVersion)))
      .returning();
    const row = rows[0];
    return row ? this._toFull(row) : null;
  }

  /**
   * Атомарно списывает 1 из квоты (`WHERE invites_remaining > 0`).
   * @param id Идентификатор.
   * @returns true, если списано; false, если квота исчерпана.
   */
  public async decrementInvitesRemaining(id: string): Promise<boolean> {
    const rows = await this._db
      .update(accounts)
      .set({ invitesRemaining: sql`${accounts.invitesRemaining} - 1` })
      .where(and(eq(accounts.id, id), gt(accounts.invitesRemaining, 0)))
      .returning({ id: accounts.id });
    return rows.length > 0;
  }

  /**
   * Атомарно возвращает 1 в квоту (отзыв кода).
   * @param id Идентификатор.
   * @returns Промис завершения.
   */
  public async incrementInvitesRemaining(id: string): Promise<void> {
    await this._db
      .update(accounts)
      .set({ invitesRemaining: sql`${accounts.invitesRemaining} + 1` })
      .where(eq(accounts.id, id));
  }

  /**
   * Маппит строку БД в доменный AccountFull (registrationSource сужаем —
   * валидность гарантирует CHECK-ограничение схемы).
   * @param row Строка accounts из Drizzle.
   * @returns Доменный AccountFull.
   */
  private _toFull(row: typeof accounts.$inferSelect): AccountFull {
    return {
      ...row,
      registrationSource: row.registrationSource as AccountFull['registrationSource'],
    };
  }

  /**
   * Разрешает исполнителя: переданная транзакция или дефолтный инстанс БД.
   * @param tx Опц. опаковая транзакция.
   * @returns DrizzleExecutor.
   */
  private _exec(tx?: Transaction): DrizzleExecutor {
    return tx === undefined ? this._db : (tx as unknown as DrizzleExecutor);
  }
}

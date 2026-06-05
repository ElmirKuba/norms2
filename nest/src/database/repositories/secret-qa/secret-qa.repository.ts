import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { secretQa } from '../../schemas/secret-qa.schema';
import type { SecretQaRepositoryPort } from '../../../modules/recovery/adapters/secret-qa-repository.port';
import type { SecretQaCreate } from '../../../modules/recovery/interfaces/secret-qa-create.interface';
import type { SecretQaFull } from '../../../modules/recovery/interfaces/secret-qa-full.interface';

/**
 * Drizzle-реализация порта секретных вопросов (единственное место, где про ORM
 * знают). Строки структурно совпадают с SecretQaFull (колонки 1:1) → прямой возврат.
 */
@Injectable()
export class SecretQaRepository implements SecretQaRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Добавляет вопрос.
   * @param id Идентификатор.
   * @param data Данные.
   * @returns Созданная строка.
   * @throws {Error} Если INSERT не вернул строку.
   */
  public async add(id: string, data: SecretQaCreate): Promise<SecretQaFull> {
    const rows = await this._db
      .insert(secretQa)
      .values({ id, accountId: data.accountId, question: data.question, answerHash: data.answerHash })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT secret_qa не вернул строку.');
    }
    return row;
  }

  /**
   * Вопросы аккаунта (новые сверху).
   * @param accountId Владелец.
   * @returns Строки.
   */
  public async listByAccount(accountId: string): Promise<SecretQaFull[]> {
    return this._db
      .select()
      .from(secretQa)
      .where(eq(secretQa.accountId, accountId))
      .orderBy(desc(secretQa.createdAt));
  }

  /**
   * Удаляет свой вопрос.
   * @param id Идентификатор.
   * @param accountId Владелец.
   * @returns true, если удалён.
   */
  public async removeOwn(id: string, accountId: string): Promise<boolean> {
    const rows = await this._db
      .delete(secretQa)
      .where(and(eq(secretQa.id, id), eq(secretQa.accountId, accountId)))
      .returning({ id: secretQa.id });
    return rows.length > 0;
  }

  /**
   * Количество вопросов аккаунта.
   * @param accountId Владелец.
   * @returns Число.
   */
  public async countByAccount(accountId: string): Promise<number> {
    const rows = await this._db
      .select({ value: count() })
      .from(secretQa)
      .where(eq(secretQa.accountId, accountId));
    return rows[0]?.value ?? 0;
  }

  /**
   * Вопросы аккаунта по набору id (только этого владельца).
   * @param ids Идентификаторы.
   * @param accountId Владелец.
   * @returns Найденные строки.
   */
  public async findByIdsForAccount(ids: string[], accountId: string): Promise<SecretQaFull[]> {
    if (ids.length === 0) {
      return [];
    }
    return this._db
      .select()
      .from(secretQa)
      .where(and(inArray(secretQa.id, ids), eq(secretQa.accountId, accountId)));
  }
}

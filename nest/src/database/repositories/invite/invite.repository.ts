import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase, DrizzleExecutor } from '../../client/database.constants';
import { inviteCodes } from '../../schemas/invite-codes.schema';
import { invitations } from '../../schemas/invitations.schema';
import type { InviteRepositoryPort } from '../../../modules/invites/adapters/invite-repository.port';
import type { InviteCodeFull } from '../../../modules/invites/interfaces/invite-code-full.interface';
import type { InviteCodeCreate } from '../../../modules/invites/interfaces/invite-code-create.interface';
import type { InvitationFull } from '../../../modules/invites/interfaces/invitation-full.interface';
import type { InvitationCreate } from '../../../modules/invites/interfaces/invitation-create.interface';
import type { Transaction } from '../../../shared/transactions/transaction.interface';

/**
 * Drizzle-реализация порта инвайтов. Опаковый `tx` приводится к DrizzleExecutor
 * внутри (см. _exec) — наружу ORM не утекает. Строки структурно совпадают с
 * InviteCodeFull/InvitationFull (без union-колонок) → маппинг прямой.
 */
@Injectable()
export class InviteRepository implements InviteRepositoryPort {
  /**
   * @param _db Инстанс Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Создаёт pending-код.
   * @param id Идентификатор.
   * @param data Данные кода.
   * @param tx Опц. транзакция.
   * @returns Созданный код.
   * @throws {Error} Если INSERT не вернул строку.
   */
  public async createCode(id: string, data: InviteCodeCreate, tx?: Transaction): Promise<InviteCodeFull> {
    const rows = await this._exec(tx).insert(inviteCodes).values({ id, ...data }).returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT invite_codes не вернул строку.');
    }
    return row;
  }

  /**
   * Находит активный (не истёкший) код по значению.
   * @param code Значение кода.
   * @returns Код или null.
   */
  public async findActiveCodeByValue(code: string): Promise<InviteCodeFull | null> {
    const rows = await this._db
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, code), gt(inviteCodes.expiresAt, new Date())))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Удаляет код по id.
   * @param id Идентификатор.
   * @param tx Опц. транзакция.
   * @returns true, если строка удалена.
   */
  public async deleteCode(id: string, tx?: Transaction): Promise<boolean> {
    const rows = await this._exec(tx)
      .delete(inviteCodes)
      .where(eq(inviteCodes.id, id))
      .returning({ id: inviteCodes.id });
    return rows.length > 0;
  }

  /**
   * Создаёт ребро приглашения.
   * @param id Идентификатор.
   * @param data Данные ребра.
   * @param tx Опц. транзакция.
   * @returns Созданное ребро.
   * @throws {Error} Если INSERT не вернул строку.
   */
  public async insertInvitation(id: string, data: InvitationCreate, tx?: Transaction): Promise<InvitationFull> {
    const rows = await this._exec(tx).insert(invitations).values({ id, ...data }).returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT invitations не вернул строку.');
    }
    return row;
  }

  /**
   * Список приглашённых данным аккаунтом.
   * @param inviterId Идентификатор пригласившего.
   * @returns Рёбра приглашений.
   */
  public async listInviteesByInviter(inviterId: string): Promise<InvitationFull[]> {
    return this._db.select().from(invitations).where(eq(invitations.inviterId, inviterId));
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

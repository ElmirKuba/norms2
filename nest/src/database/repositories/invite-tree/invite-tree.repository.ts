import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import type { InviteTreeRepositoryPort } from '../../../modules/invites/adapters/invite-tree-repository.port';

/**
 * Drizzle-реализация дерева приглашений через рекурсивный CTE (единственное место,
 * где про SQL дерева знают). Цикл в данных невозможен: у `invitations` UNIQUE по
 * `account_id` (≤1 родитель) и пригласивший создан раньше приглашённого.
 */
@Injectable()
export class InviteTreeRepository implements InviteTreeRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Поднимается от потомка по `inviter_id` и проверяет, встречается ли предок.
   * @param ancestorId Кандидат-предок.
   * @param descendantId Кандидат-потомок.
   * @returns true, если предок найден в цепочке вверх.
   */
  public async isAncestor(ancestorId: string, descendantId: string): Promise<boolean> {
    // Себя предком не считаем (нельзя забанить себя — ADR-0003).
    if (ancestorId === descendantId) {
      return false;
    }
    const result = await this._db.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT account_id, inviter_id
          FROM invitations
         WHERE account_id = ${descendantId}
        UNION ALL
        SELECT i.account_id, i.inviter_id
          FROM invitations i
          JOIN chain c ON i.account_id = c.inviter_id
      )
      SELECT 1 FROM chain WHERE inviter_id = ${ancestorId} LIMIT 1
    `);
    return result.rows.length > 0;
  }
}

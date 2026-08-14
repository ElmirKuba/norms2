import { Injectable } from '@nestjs/common';
import { BanDomainService } from '../../bans/domain-services/ban.domain-service';
import {
  AUDIT_ACTIONS,
  AuditDomainService,
} from '../../audit/domain-services/audit.domain-service';
import type { AdminActor } from '../interfaces/admin-actor.interface';

/**
 * Снятие всех банов с человека из админки (`DELETE /admin/bans/of/:accountId`, 2.9.3·26).
 *
 * **Снимаются все активные, а не выбранный.** На экране «Люди и роли» админ видит человека, а не
 * список чужих решений о нём; «снял один из трёх» там неотличимо от «ничего не изменилось».
 * Точечное снятие по записи осталось отдельной ручкой (`POST /admin/bans/:id/lift`).
 */
@Injectable()
export class LiftBansOfAccountUseCase {
  /**
   * @param _bans Domain-service банов.
   * @param _audit Журнал действий.
   */
  public constructor(
    private readonly _bans: BanDomainService,
    private readonly _audit: AuditDomainService,
  ) {}

  /**
   * Снимает все активные баны с человека.
   * @param accountId Кого разбанить.
   * @param actor Кто снимает.
   * @returns Сколько записей снято.
   */
  public async execute(accountId: string, actor: AdminActor): Promise<number> {
    const lifted = await this._bans.liftAllFor(accountId);
    if (lifted > 0) {
      await this._audit.record({
        actorAccountId: actor.accountId,
        actorLogin: actor.login,
        action: AUDIT_ACTIONS.BAN_LIFTED,
        targetType: 'account',
        targetId: accountId,
        details: { lifted, byAdmin: true },
      });
    }
    return lifted;
  }
}

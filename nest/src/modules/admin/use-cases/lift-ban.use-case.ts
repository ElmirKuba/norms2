import { Injectable } from '@nestjs/common';
import { BanDomainService } from '../../bans/domain-services/ban.domain-service';
import {
  AUDIT_ACTIONS,
  AuditDomainService,
} from '../../audit/domain-services/audit.domain-service';
import type { AdminActor } from '../interfaces/admin-actor.interface';

/**
 * Снятие бана админом (`POST /admin/bans/:id/lift`, 2.9.3·21).
 *
 * **Зачем нужна дверь помимо ветки.** Снять бан вправе банивший или его предок
 * ([ADR-0003, дополнение](../../../../docs/decisions/0003-ban-semantics.md)) — но банивший мог
 * удалить аккаунт, а ветка выше молчать или тоже исчезнуть. Тогда бан становился вечным: его не
 * мог снять вообще никто, а забаненный видел «вы забанены» и не имел ни одного пути дальше.
 * Баны намеренно переживают удаление аккаунта ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md)),
 * поэтому дверь администратора — не удобство, а недостающий выход.
 */
@Injectable()
export class LiftBanUseCase {
  /**
   * @param _bans Domain-service банов (кросс-домен вниз).
   * @param _audit Журнал действий.
   */
  public constructor(
    private readonly _bans: BanDomainService,
    private readonly _audit: AuditDomainService,
  ) {}

  /**
   * Снимает любой активный бан.
   * @param banId Идентификатор записи.
   * @param actor Кто снимает (аккаунт из Guard).
   * @returns Промис завершения.
   * @throws {BanNotFoundError} Если записи нет или она уже снята.
   */
  public async execute(banId: string, actor: AdminActor): Promise<void> {
    const ban = await this._bans.getActive(banId);
    await this._bans.lift(banId);
    await this._audit.record({
      actorAccountId: actor.accountId,
      actorLogin: actor.login,
      action: AUDIT_ACTIONS.BAN_LIFTED,
      targetType: 'account',
      targetId: ban.targetId,
      details: { bannerId: ban.bannerId, reason: ban.reason, byAdmin: true },
    });
  }
}

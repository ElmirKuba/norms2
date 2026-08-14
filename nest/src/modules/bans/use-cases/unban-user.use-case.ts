import { Injectable } from '@nestjs/common';
import { BanDomainService } from '../domain-services/ban.domain-service';
import { InviteTreeDomainService } from '../../invites/domain-services/invite-tree.domain-service';
import {
  AUDIT_ACTIONS,
  AuditDomainService,
} from '../../audit/domain-services/audit.domain-service';
import { BanNotFoundError } from '../../../shared/errors/ban-not-found.error';

/**
 * Снятие бана (2.9.3·21, [ADR-0003, дополнение](../../../../docs/decisions/0003-ban-semantics.md)).
 *
 * **Право снимать идёт вверх по ветке, как и право банить.** Забанить может любой предок цели;
 * до 2.9.3 снять мог только тот, кто банил, — и это была асимметрия: Артём вправе забанить Дашу
 * сам, но не вправе снять бан, наложенный Викой, хотя он выше по ветке и отвечает за всю
 * подветку. Ветки задумывались как ответственность вверх, и в одну сторону она не работает.
 *
 * Проверка живёт здесь, а не в domain-service, по той же причине, что и у бана: она требует
 * дерева приглашений — чужой области, и кросс-домен ходит только вниз из use-case.
 *
 * **Чужой бан = не найден.** Постороннему не сообщаем, существует ли запись: то же правило, что
 * у остальных чужих сущностей.
 */
@Injectable()
export class UnbanUserUseCase {
  /**
   * @param _banDomainService Domain-service банов.
   * @param _inviteTree Дерево приглашений (кросс-домен вниз).
   * @param _audit Журнал действий.
   */
  public constructor(
    private readonly _banDomainService: BanDomainService,
    private readonly _inviteTree: InviteTreeDomainService,
    private readonly _audit: AuditDomainService,
  ) {}

  /**
   * Снимает бан, если запрашивающий вправе.
   * @param banId Идентификатор записи.
   * @param requesterId Запросивший (из Guard).
   * @param requesterLogin Логин запросившего — снимком в журнал.
   * @returns Промис завершения.
   * @throws {BanNotFoundError} Если записи нет, она уже снята или снимает посторонний.
   */
  public async execute(banId: string, requesterId: string, requesterLogin: string): Promise<void> {
    const ban = await this._banDomainService.getActive(banId);
    const own = ban.bannerId === requesterId;
    const above = own ? false : await this._inviteTree.isAncestor(requesterId, ban.bannerId);
    if (!own && !above) {
      throw new BanNotFoundError('Бан не найден.');
    }

    await this._banDomainService.lift(banId);
    await this._audit.record({
      actorAccountId: requesterId,
      actorLogin: requesterLogin,
      action: AUDIT_ACTIONS.BAN_LIFTED,
      targetType: 'account',
      targetId: ban.targetId,
      details: { bannerId: ban.bannerId, reason: ban.reason, byBranch: above },
    });
  }
}

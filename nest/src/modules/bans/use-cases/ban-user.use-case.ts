import { Injectable } from '@nestjs/common';
import { BanDomainService } from '../domain-services/ban.domain-service';
import { InviteTreeDomainService } from '../../invites/domain-services/invite-tree.domain-service';
import { BanForbiddenError } from '../../../shared/errors/ban-forbidden.error';
import type { BanFull } from '../interfaces/ban-full.interface';

/**
 * Use-case бана (оркестрация кросс-домена). Проверяет право `isAncestor(me,target)`
 * (invites↓, ADR-0003), затем ставит бан (bans↓). Себя/вверх по дереву — нельзя.
 */
@Injectable()
export class BanUserUseCase {
  /**
   * @param _banDomainService Domain-service bans (запись).
   * @param _inviteTreeDomainService Domain-service дерева (право банить).
   */
  public constructor(
    private readonly _banDomainService: BanDomainService,
    private readonly _inviteTreeDomainService: InviteTreeDomainService,
  ) {}

  /**
   * Банит цель, если она в поддереве банящего.
   * @param bannerId Банящий (из Guard).
   * @param targetId Цель.
   * @param reason Причина.
   * @returns Созданная/обновлённая запись бана.
   * @throws {BanForbiddenError} Если цель = сам или вне своего поддерева.
   */
  public async execute(bannerId: string, targetId: string, reason: string): Promise<BanFull> {
    if (bannerId === targetId) {
      throw new BanForbiddenError('Нельзя забанить себя.');
    }
    const allowed = await this._inviteTreeDomainService.isAncestor(bannerId, targetId);
    if (!allowed) {
      throw new BanForbiddenError('Банить можно только в своём поддереве приглашений.');
    }
    return this._banDomainService.ban(bannerId, targetId, reason);
  }
}

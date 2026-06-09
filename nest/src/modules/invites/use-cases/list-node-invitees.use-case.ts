import { Injectable } from '@nestjs/common';
import { InviteDomainService } from '../domain-services/invite.domain-service';
import { InviteTreeDomainService } from '../domain-services/invite-tree.domain-service';
import { SubtreeForbiddenError } from '../../../shared/errors/subtree-forbidden.error';
import type { InviteeNode } from '../interfaces/invitee-node.interface';

/**
 * Use-case ленивого раскрытия дерева (F3.Д): прямые дети узла. Право смотреть —
 * только свой узел или узел в своём поддереве (`isAncestor`, та же граница, что у
 * права банить, ADR-0003). Иначе 403. Кросс-домен ВНИЗ: invite-tree + invite.
 */
@Injectable()
export class ListNodeInviteesUseCase {
  /**
   * @param _inviteDomainService Domain-service invites (список детей).
   * @param _inviteTreeDomainService Domain-service дерева (проверка права).
   */
  public constructor(
    private readonly _inviteDomainService: InviteDomainService,
    private readonly _inviteTreeDomainService: InviteTreeDomainService,
  ) {}

  /**
   * Прямые дети узла, если смотрящий вправе их видеть.
   * @param viewerId Смотрящий (из Guard).
   * @param nodeId Узел, чьих детей раскрываем.
   * @returns Дети узла (+ флаг bannedByMe).
   * @throws {SubtreeForbiddenError} Если узел не свой и не в своём поддереве.
   */
  public async execute(viewerId: string, nodeId: string): Promise<InviteeNode[]> {
    if (nodeId !== viewerId) {
      const allowed = await this._inviteTreeDomainService.isAncestor(viewerId, nodeId);
      if (!allowed) {
        throw new SubtreeForbiddenError('Этот узел не в вашем поддереве приглашений.');
      }
    }
    return this._inviteDomainService.listInviteesOf(nodeId, viewerId);
  }
}

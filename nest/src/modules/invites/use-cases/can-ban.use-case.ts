import { Injectable } from '@nestjs/common';
import { InviteTreeDomainService } from '../domain-services/invite-tree.domain-service';
import type { CanBanResponse } from '../interfaces/can-ban-response.interface';

/**
 * Use-case проверки права бана (F3.Д): та же граница, что у `POST /bans` — цель не
 * сам и в своём поддереве (`isAncestor`, ADR-0003). Для UI (видимость кнопки), не
 * заменяет серверную проверку в `BanUserUseCase`.
 */
@Injectable()
export class CanBanUseCase {
  /**
   * @param _inviteTreeDomainService Domain-service дерева (isAncestor).
   */
  public constructor(private readonly _inviteTreeDomainService: InviteTreeDomainService) {}

  /**
   * Вправе ли смотрящий забанить целевой аккаунт.
   * @param viewerId Смотрящий (из Guard).
   * @param targetId Цель.
   * @returns { allowed }.
   */
  public async execute(viewerId: string, targetId: string): Promise<CanBanResponse> {
    if (viewerId === targetId) {
      return { allowed: false };
    }
    return { allowed: await this._inviteTreeDomainService.isAncestor(viewerId, targetId) };
  }
}

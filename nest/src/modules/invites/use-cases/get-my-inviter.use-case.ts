import { Injectable } from '@nestjs/common';
import { InviteDomainService } from '../domain-services/invite.domain-service';
import type { InviterRead } from '../interfaces/inviter-read.interface';

/**
 * Use-case «кто меня пригласил». null у корней дерева (free/seed).
 */
@Injectable()
export class GetMyInviterUseCase {
  /**
   * @param _inviteDomainService Domain-service invites.
   */
  public constructor(private readonly _inviteDomainService: InviteDomainService) {}

  /**
   * Возвращает пригласившего данный аккаунт.
   * @param accountId Идентификатор приглашённого (текущий аккаунт).
   * @returns Проекция пригласившего или null.
   */
  public async execute(accountId: string): Promise<InviterRead | null> {
    return this._inviteDomainService.getInviterOf(accountId);
  }
}

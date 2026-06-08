import { Injectable } from '@nestjs/common';
import { InviteDomainService } from '../domain-services/invite.domain-service';
import type { InviteeRead } from '../interfaces/invitee-read.interface';

/**
 * Use-case списка «мои приглашённые».
 */
@Injectable()
export class ListMyInvitesUseCase {
  /**
   * @param _inviteDomainService Domain-service invites.
   */
  public constructor(private readonly _inviteDomainService: InviteDomainService) {}

  /**
   * Список приглашённых данным аккаунтом.
   * @param inviterId Идентификатор пригласившего.
   * @returns Список приглашённых.
   */
  public async execute(inviterId: string): Promise<InviteeRead[]> {
    return this._inviteDomainService.listInvitees(inviterId);
  }
}

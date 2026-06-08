import { Injectable } from '@nestjs/common';
import { InviteDomainService } from '../domain-services/invite.domain-service';
import type { InviteCodeRead } from '../interfaces/invite-code-read.interface';

/**
 * Use-case списка «мои невыданные коды» (активные, для отзыва/обзора).
 */
@Injectable()
export class ListMyCodesUseCase {
  /**
   * @param _inviteDomainService Domain-service invites.
   */
  public constructor(private readonly _inviteDomainService: InviteDomainService) {}

  /**
   * Список невыданных кодов создателя.
   * @param inviterId Идентификатор создателя (текущий аккаунт).
   * @returns Проекции кодов.
   */
  public async execute(inviterId: string): Promise<InviteCodeRead[]> {
    return this._inviteDomainService.listMyCodes(inviterId);
  }
}

import { Injectable } from '@nestjs/common';
import { InviteDomainService } from '../domain-services/invite.domain-service';
import type { CheckInviteResponse } from '../interfaces/check-invite-response.interface';

/**
 * Use-case предпроверки кода (для фронта при invite-режиме регистрации).
 */
@Injectable()
export class CheckInviteCodeUseCase {
  /**
   * @param _inviteDomainService Domain-service invites.
   */
  public constructor(private readonly _inviteDomainService: InviteDomainService) {}

  /**
   * Проверяет валидность кода.
   * @param rawCode Сырой код.
   * @returns { valid }.
   */
  public async execute(rawCode: string): Promise<CheckInviteResponse> {
    return { valid: await this._inviteDomainService.checkCode(rawCode) };
  }
}

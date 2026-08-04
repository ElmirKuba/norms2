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
   * Проверяет код и отдаёт подпись, с которой он выдан.
   * @param rawCode Сырой код.
   * @returns `{ valid, reason }`.
   */
  public async execute(rawCode: string): Promise<CheckInviteResponse> {
    return this._inviteDomainService.describeCode(rawCode);
  }
}

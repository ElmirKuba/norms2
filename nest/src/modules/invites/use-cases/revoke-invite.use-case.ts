import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { InviteDomainService } from '../domain-services/invite.domain-service';

/**
 * Use-case отзыва инвайта: удаляет СВОЙ pending-код (invites↓), затем возвращает
 * квоту (account↑). Если код не свой/не найден — revokeCode бросит, квота не тронута.
 */
@Injectable()
export class RevokeInviteUseCase {
  /**
   * @param _inviteDomainService Domain-service invites (отзыв кода).
   * @param _accountDomainService Domain-service account (возврат квоты).
   */
  public constructor(
    private readonly _inviteDomainService: InviteDomainService,
    private readonly _accountDomainService: AccountDomainService,
  ) {}

  /**
   * Отзывает код приглашения.
   * @param codeId Идентификатор кода.
   * @param requesterId Идентификатор запросившего (создатель).
   * @returns Промис завершения.
   * @throws {InviteInvalidError} Если код не найден или не принадлежит запросившему.
   */
  public async execute(codeId: string, requesterId: string): Promise<void> {
    await this._inviteDomainService.revokeCode(codeId, requesterId);
    // TODO: Claude Code: 2026-06-05: возврат квоты после delete неатомарен (краш
    // потеряет слот). При желании — транзакция (revoke+increment) tx-aware методами.
    await this._accountDomainService.returnInviteQuota(requesterId);
  }
}

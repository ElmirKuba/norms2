import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { InviteDomainService } from '../domain-services/invite.domain-service';
import { QuotaExceededError } from '../../../shared/errors/quota-exceeded.error';
import type { InviteCodeFull } from '../interfaces/invite-code-full.interface';

/**
 * Use-case создания инвайта (оркестрация кросс-домена). Списывает квоту (account↓),
 * затем создаёт код (invites↓). Если код не создался — возвращает квоту (компенсация).
 */
@Injectable()
export class CreateInviteUseCase {
  /**
   * @param _accountDomainService Domain-service account (квота).
   * @param _inviteDomainService Domain-service invites (код).
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _inviteDomainService: InviteDomainService,
  ) {}

  /**
   * Создаёт код приглашения.
   * @param inviterId Идентификатор создателя.
   * @param reason Причина.
   * @returns Созданный код.
   * @throws {QuotaExceededError} Если квота исчерпана.
   */
  public async execute(inviterId: string, reason: string): Promise<InviteCodeFull> {
    const consumed = await this._accountDomainService.consumeInviteQuota(inviterId);
    if (!consumed) {
      throw new QuotaExceededError('Квота приглашений исчерпана.');
    }
    try {
      return await this._inviteDomainService.createCode(inviterId, reason);
    } catch (error) {
      // Код не создался — возвращаем списанную квоту.
      // TODO: Claude Code: 2026-06-05: компенсация неатомарна (краш между decrement и
      // createCode потеряет слот квоты). При желании — обернуть в транзакцию tx-aware.
      await this._accountDomainService.returnInviteQuota(inviterId);
      throw error;
    }
  }
}

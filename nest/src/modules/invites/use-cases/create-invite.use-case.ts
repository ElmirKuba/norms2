import { Inject, Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { InviteDomainService } from '../domain-services/invite.domain-service';
import { QuotaExceededError } from '../../../shared/errors/quota-exceeded.error';
import { TRANSACTION_RUNNER } from '../../../shared/transactions/transaction-runner.port';
import type { TransactionRunnerPort } from '../../../shared/transactions/transaction-runner.port';
import type { InviteCodeFull } from '../interfaces/invite-code-full.interface';

/**
 * Use-case создания инвайта (оркестрация кросс-домена) — в ОДНОЙ транзакции:
 * списывает квоту (account↓) и создаёт код (invites↓). Не списалось → QuotaExceeded
 * (откат пуст). Код не создался → исключение откатывает и списание квоты (атомарно,
 * без ручной компенсации).
 */
@Injectable()
export class CreateInviteUseCase {
  /**
   * @param _accountDomainService Domain-service account (квота).
   * @param _inviteDomainService Domain-service invites (код).
   * @param _transactionRunner Раннер транзакций (атомарность списание+создание).
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _inviteDomainService: InviteDomainService,
    @Inject(TRANSACTION_RUNNER) private readonly _transactionRunner: TransactionRunnerPort,
  ) {}

  /**
   * Создаёт код приглашения.
   * @param inviterId Идентификатор создателя.
   * @param reason Причина.
   * @returns Созданный код.
   * @throws {QuotaExceededError} Если квота исчерпана.
   */
  public async execute(inviterId: string, reason: string): Promise<InviteCodeFull> {
    return this._transactionRunner.run(async (tx) => {
      const consumed = await this._accountDomainService.consumeInviteQuota(inviterId, tx);
      if (!consumed) {
        throw new QuotaExceededError('Квота приглашений исчерпана.');
      }
      return this._inviteDomainService.createCode(inviterId, reason, tx);
    });
  }
}

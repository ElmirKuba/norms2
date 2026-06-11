import { Inject, Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { InviteDomainService } from '../domain-services/invite.domain-service';
import { TRANSACTION_RUNNER } from '../../../shared/transactions/transaction-runner.port';
import type { TransactionRunnerPort } from '../../../shared/transactions/transaction-runner.port';

/**
 * Use-case отзыва инвайта — в ОДНОЙ транзакции: удаляет СВОЙ pending-код (invites↓)
 * и возвращает квоту (account↑). Код не свой/не найден → revokeCode бросит → откат
 * (квота не тронута). Атомарно, без ручной компенсации.
 */
@Injectable()
export class RevokeInviteUseCase {
  /**
   * @param _inviteDomainService Domain-service invites (отзыв кода).
   * @param _accountDomainService Domain-service account (возврат квоты).
   * @param _transactionRunner Раннер транзакций (атомарность отзыв+возврат).
   */
  public constructor(
    private readonly _inviteDomainService: InviteDomainService,
    private readonly _accountDomainService: AccountDomainService,
    @Inject(TRANSACTION_RUNNER) private readonly _transactionRunner: TransactionRunnerPort,
  ) {}

  /**
   * Отзывает код приглашения.
   * @param codeId Идентификатор кода.
   * @param requesterId Идентификатор запросившего (создатель).
   * @returns Промис завершения.
   * @throws {InviteInvalidError} Если код не найден или не принадлежит запросившему.
   */
  public async execute(codeId: string, requesterId: string): Promise<void> {
    await this._transactionRunner.run(async (tx) => {
      await this._inviteDomainService.revokeCode(codeId, requesterId, tx);
      await this._accountDomainService.returnInviteQuota(requesterId, tx);
    });
  }
}

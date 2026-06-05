import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { SessionDomainService } from '../../sessions/domain-services/session.domain-service';

/**
 * Use-case само-удаления (soft-delete, ADR-0017): помечает аккаунт удалённым и
 * отзывает все сессии. Восстановления на сайте нет — узел дерева остаётся.
 */
@Injectable()
export class DeleteMyAccountUseCase {
  /**
   * @param _accountDomainService Domain-service account.
   * @param _sessionDomainService Domain-service sessions (отзыв всех).
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _sessionDomainService: SessionDomainService,
  ) {}

  /**
   * Удаляет (soft) свой аккаунт и отзывает все его сессии.
   * @param accountId Владелец (из Guard).
   * @returns Промис завершения.
   */
  public async execute(accountId: string): Promise<void> {
    await this._accountDomainService.softDelete(accountId);
    await this._sessionDomainService.revokeAllForAccount(accountId);
  }
}

import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';

/**
 * Use-case само-удаления (soft-delete, ADR-0017): помечает аккаунт удалённым.
 * Восстановления на сайте нет — узел дерева остаётся ради целостности.
 */
@Injectable()
export class DeleteMyAccountUseCase {
  /**
   * @param _accountDomainService Domain-service account.
   */
  public constructor(private readonly _accountDomainService: AccountDomainService) {}

  /**
   * Удаляет (soft) свой аккаунт.
   * @param accountId Владелец (из Guard).
   * @returns Промис завершения.
   */
  public async execute(accountId: string): Promise<void> {
    await this._accountDomainService.softDelete(accountId);
    // TODO: Claude Code: 2026-06-05: после удаления отозвать refresh-сессии
    // аккаунта (кросс-домен sessions↓) — закрыть на R3.
  }
}

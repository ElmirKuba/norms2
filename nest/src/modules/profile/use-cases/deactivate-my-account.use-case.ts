import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';

/**
 * Use-case само-деактивации (обратимая пауза, ADR-0017). Реактивация — отдельным
 * публичным флоу (`POST /auth/reactivate`, ADR-0039), т.к. деактивированный не
 * проходит Guard.
 */
@Injectable()
export class DeactivateMyAccountUseCase {
  /**
   * @param _accountDomainService Domain-service account.
   */
  public constructor(private readonly _accountDomainService: AccountDomainService) {}

  /**
   * Деактивирует свой аккаунт.
   * @param accountId Владелец (из Guard).
   * @returns Промис завершения.
   */
  public async execute(accountId: string): Promise<void> {
    await this._accountDomainService.deactivate(accountId);
    // TODO: Claude Code: 2026-06-05: после деактивации отозвать refresh-сессии
    // аккаунта (кросс-домен sessions↓) — закрыть на R3.
  }
}

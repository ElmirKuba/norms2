import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { SessionDomainService } from '../../sessions/domain-services/session.domain-service';

/**
 * Use-case само-деактивации (обратимая пауза, ADR-0017). Реактивация — отдельным
 * публичным флоу (`POST /auth/reactivate`, ADR-0039), т.к. деактивированный не
 * проходит Guard. Отзывает все сессии (везде выйти).
 */
@Injectable()
export class DeactivateMyAccountUseCase {
  /**
   * @param _accountDomainService Domain-service account.
   * @param _sessionDomainService Domain-service sessions (отзыв всех).
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _sessionDomainService: SessionDomainService,
  ) {}

  /**
   * Деактивирует свой аккаунт и отзывает все его сессии.
   * @param accountId Владелец (из Guard).
   * @returns Промис завершения.
   */
  public async execute(accountId: string): Promise<void> {
    await this._accountDomainService.deactivate(accountId);
    await this._sessionDomainService.revokeAllForAccount(accountId);
  }
}

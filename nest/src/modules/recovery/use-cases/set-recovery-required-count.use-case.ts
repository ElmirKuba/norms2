import { Injectable } from '@nestjs/common';
import { SecretQaDomainService } from '../domain-services/secret-qa.domain-service';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { RecoveryRequiredCountInvalidError } from '../../../shared/errors/recovery-required-count-invalid.error';

/**
 * Use-case установки K (recovery_required_count). Кросс-домен: считает N вопросов
 * (recovery↓), проверяет `1 ≤ K ≤ N`, пишет K на аккаунт (account↓).
 */
@Injectable()
export class SetRecoveryRequiredCountUseCase {
  /**
   * @param _secretQaDomainService Domain-service вопросов (счёт N).
   * @param _accountDomainService Domain-service account (запись K).
   */
  public constructor(
    private readonly _secretQaDomainService: SecretQaDomainService,
    private readonly _accountDomainService: AccountDomainService,
  ) {}

  /**
   * Устанавливает K.
   * @param accountId Владелец (из Guard).
   * @param requiredCount Желаемое K.
   * @returns Промис завершения.
   * @throws {RecoveryRequiredCountInvalidError} Если K вне `1..N`.
   */
  public async execute(accountId: string, requiredCount: number): Promise<void> {
    const total = await this._secretQaDomainService.countQuestions(accountId);
    if (total === 0 || requiredCount < 1 || requiredCount > total) {
      throw new RecoveryRequiredCountInvalidError(`K должно быть в диапазоне 1..${total}.`);
    }
    await this._accountDomainService.setRecoveryRequiredCount(accountId, requiredCount);
  }
}

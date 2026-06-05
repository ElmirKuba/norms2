import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { Alias } from '../../account/value-objects/alias.vo';
import type { AccountRead } from '../../account/interfaces/account-read.interface';

/**
 * Use-case смены псевдонима. Валидирует VO `Alias`, пишет через account-домен
 * (CAS), отдаёт обновлённый `AccountRead` (без секрета).
 */
@Injectable()
export class UpdateAliasUseCase {
  /**
   * @param _accountDomainService Domain-service account.
   */
  public constructor(private readonly _accountDomainService: AccountDomainService) {}

  /**
   * Меняет псевдоним.
   * @param accountId Владелец (из Guard).
   * @param aliasRaw Сырой псевдоним.
   * @returns Обновлённый аккаунт без секрета.
   * @throws {ValidationError} Если псевдоним не проходит VO.
   */
  public async execute(accountId: string, aliasRaw: string): Promise<AccountRead> {
    const updated = await this._accountDomainService.updateAlias(accountId, Alias.create(aliasRaw));
    const { passwordHash: _passwordHash, ...read } = updated;
    return read;
  }
}

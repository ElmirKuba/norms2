import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { AccountNotFoundError } from '../../../shared/errors/account-not-found.error';
import type { AccountPublicView } from '../../account/interfaces/account-public-view.interface';

/**
 * Use-case публичного профиля по логину (для участников). Кросс-домен ВНИЗ →
 * account. 404, если нет/удалён.
 */
@Injectable()
export class GetProfileByLoginUseCase {
  /**
   * @param _accountDomainService Domain-service account.
   */
  public constructor(private readonly _accountDomainService: AccountDomainService) {}

  /**
   * Возвращает публичную проекцию профиля.
   * @param login Логин искомого аккаунта.
   * @returns Публичная проекция.
   * @throws {AccountNotFoundError} Если нет/удалён.
   */
  public async execute(login: string): Promise<AccountPublicView> {
    const profile = await this._accountDomainService.getPublicByLogin(login);
    if (profile === null) {
      throw new AccountNotFoundError('Профиль не найден.');
    }
    return profile;
  }
}

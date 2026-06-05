import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';

/**
 * Use-case реактивации (публичный, ADR-0039): деактивированный не проходит Guard,
 * поэтому путь — по логину+паролю. Проверяет учётные данные (допускает
 * деактивированного, не удалённого) и снимает паузу. Токенов не выдаёт — после
 * успеха пользователь входит обычным login.
 */
@Injectable()
export class ReactivateAccountUseCase {
  /**
   * @param _accountDomainService Domain-service account.
   */
  public constructor(private readonly _accountDomainService: AccountDomainService) {}

  /**
   * Реактивирует аккаунт по учётным данным.
   * @param login Логин.
   * @param password Пароль-плейнтекст.
   * @returns Промис завершения.
   * @throws {BadCredentialsError} Неверные данные или аккаунт удалён.
   */
  public async execute(login: string, password: string): Promise<void> {
    const account = await this._accountDomainService.authenticateForReactivation(login, password);
    await this._accountDomainService.reactivate(account.id);
  }
}

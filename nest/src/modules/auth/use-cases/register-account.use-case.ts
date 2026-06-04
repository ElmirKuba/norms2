import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { Login } from '../../account/value-objects/login.vo';
import { Alias } from '../../account/value-objects/alias.vo';
import { Password } from '../../account/value-objects/password.vo';
import { InviteRequiredError } from '../../../shared/errors/invite-required.error';
import type { AccountRead } from '../../account/interfaces/account-read.interface';
import type { RegisterAccountInput } from '../interfaces/register-account-input.interface';
import type { Env } from '../../../system/config/env.schema';

/**
 * Use-case регистрации аккаунта (оркестрация). Кросс-домен ВНИЗ: зовёт
 * `AccountDomainService` области account. Сейчас — free-режим; invite-режим
 * (погашение кода) — на этапе I.
 */
@Injectable()
export class RegisterAccountUseCase {
  /**
   * @param _accountDomainService Domain-service области account (создание аккаунта).
   * @param _configService Конфиг (режим регистрации).
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Регистрирует аккаунт по правилам режима. Токены не выдаёт (ADR-0010).
   * @param input Сырой вход (login/alias/password/inviteCode?).
   * @returns Созданный аккаунт без секретов.
   * @throws {InviteRequiredError} Если включён invite-only режим.
   */
  public async execute(input: RegisterAccountInput): Promise<AccountRead> {
    const freeRegistration = this._configService.get('FREE_REGISTRATION', { infer: true });

    if (!freeRegistration) {
      // TODO: Claude Code: 2026-06-04: invite-режим — погасить input.inviteCode через
      // invites domain-service (ConsumeInvite) в ОДНОЙ транзакции с createAccount,
      // registrationSource='invite' (этап I). Сейчас invite-only недоступен.
      throw new InviteRequiredError('Регистрация только по приглашению (скоро будет доступна).');
    }

    const account = await this._accountDomainService.createAccount({
      login: Login.create(input.login),
      alias: Alias.create(input.alias),
      password: Password.create(input.password),
      registrationSource: 'free',
    });

    // Секрет наружу не отдаём.
    const { passwordHash: _passwordHash, ...read } = account;
    return read;
  }
}

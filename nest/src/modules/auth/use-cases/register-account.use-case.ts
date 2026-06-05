import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { InviteDomainService } from '../../invites/domain-services/invite.domain-service';
import { Login } from '../../account/value-objects/login.vo';
import { Alias } from '../../account/value-objects/alias.vo';
import { Password } from '../../account/value-objects/password.vo';
import { InviteRequiredError } from '../../../shared/errors/invite-required.error';
import { TRANSACTION_RUNNER } from '../../../shared/transactions/transaction-runner.port';
import type { TransactionRunnerPort } from '../../../shared/transactions/transaction-runner.port';
import type { AccountFull } from '../../account/interfaces/account-full.interface';
import type { AccountRead } from '../../account/interfaces/account-read.interface';
import type { RegisterAccountInput } from '../interfaces/register-account-input.interface';
import type { Env } from '../../../system/config/env.schema';

/**
 * Use-case регистрации аккаунта (оркестрация). Кросс-домен ВНИЗ (ADR-0030): зовёт
 * domain-services областей `account` и `invites`. Free-режим — создаёт аккаунт
 * source='free'. Invite-режим — погашает код и создаёт аккаунт source='invite' в
 * ОДНОЙ транзакции (`TransactionRunner`): либо аккаунт+ребро приглашения, либо
 * ничего. Токены не выдаёт (ADR-0010).
 */
@Injectable()
export class RegisterAccountUseCase {
  /**
   * @param _accountDomainService Domain-service области account (создание аккаунта).
   * @param _inviteDomainService Domain-service области invites (погашение кода).
   * @param _transactionRunner Раннер транзакций (атомарность invite-регистрации).
   * @param _configService Конфиг (режим регистрации).
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _inviteDomainService: InviteDomainService,
    @Inject(TRANSACTION_RUNNER) private readonly _transactionRunner: TransactionRunnerPort,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Регистрирует аккаунт по правилам режима. Токены не выдаёт (ADR-0010).
   * @param input Сырой вход (login/alias/password/inviteCode?).
   * @returns Созданный аккаунт без секретов.
   * @throws {InviteRequiredError} Если включён invite-only режим, но кода нет.
   * @throws {InviteInvalidError} Если код недействителен/истёк/использован.
   */
  public async execute(input: RegisterAccountInput): Promise<AccountRead> {
    const freeRegistration = this._configService.get('FREE_REGISTRATION', { infer: true });

    const account = freeRegistration
      ? await this._registerFree(input)
      : await this._registerByInvite(input);

    // Секрет наружу не отдаём.
    const { passwordHash: _passwordHash, ...read } = account;
    return read;
  }

  /**
   * Free-режим: просто создаёт аккаунт source='free'.
   * @param input Сырой вход.
   * @returns Созданный аккаунт.
   */
  private async _registerFree(input: RegisterAccountInput): Promise<AccountFull> {
    return this._accountDomainService.createAccount({
      login: Login.create(input.login),
      alias: Alias.create(input.alias),
      password: Password.create(input.password),
      registrationSource: 'free',
    });
  }

  /**
   * Invite-режим: в одной транзакции создаёт аккаунт source='invite' и гасит код
   * (создаёт ребро приглашения). Невалидный код → откат всего (аккаунт не создан).
   * @param input Сырой вход (inviteCode обязателен).
   * @returns Созданный аккаунт.
   * @throws {InviteRequiredError} Если код не передан.
   */
  private async _registerByInvite(input: RegisterAccountInput): Promise<AccountFull> {
    const rawCode = input.inviteCode;
    if (rawCode === undefined || rawCode === '') {
      throw new InviteRequiredError('Регистрация только по приглашению — нужен код.');
    }

    // VO валидируем ДО транзакции (дешёвый fail-fast формата).
    const login = Login.create(input.login);
    const alias = Alias.create(input.alias);
    const password = Password.create(input.password);

    return this._transactionRunner.run(async (tx) => {
      const account = await this._accountDomainService.createAccount(
        { login, alias, password, registrationSource: 'invite' },
        tx,
      );
      // Бросит InviteInvalidError при плохом коде → откат (аккаунт не сохранится).
      await this._inviteDomainService.consumeCode(rawCode, account.id, tx);
      return account;
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCOUNT_REPOSITORY } from '../adapters/account-repository.port';
import type { AccountRepositoryPort } from '../adapters/account-repository.port';
import type { AccountFull } from '../interfaces/account-full.interface';
import type { Login } from '../value-objects/login.vo';
import type { Alias } from '../value-objects/alias.vo';
import type { Password } from '../value-objects/password.vo';
import { HashService } from '../../../shared/services/hash.service';
import { LoginTakenError } from '../../../shared/errors/login-taken.error';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { Env } from '../../../system/config/env.schema';

/** Параметры создания аккаунта (валидированные VO + источник регистрации). */
export interface CreateAccountParams {
  /** Логин (VO). */
  login: Login;
  /** Псевдоним (VO). */
  alias: Alias;
  /** Пароль-плейнтекст (VO). */
  password: Password;
  /** Источник регистрации. */
  registrationSource: 'free' | 'invite' | 'seed';
}

/**
 * Domain-service области account: бизнес-логика жизненного цикла аккаунта.
 * Зависит от ПОРТА репозитория (не от Drizzle), хеш-сервиса и конфига.
 */
@Injectable()
export class AccountDomainService {
  /**
   * @param _accountRepository Порт репозитория аккаунтов (DI-токен).
   * @param _hashService Хеш-сервис argon2id.
   * @param _configService Конфиг (квота инвайтов и пр.).
   */
  public constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly _accountRepository: AccountRepositoryPort,
    private readonly _hashService: HashService,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Создаёт аккаунт: проверяет занятость логина, хеширует пароль, генерит id,
   * пишет строку. Квота инвайтов — из `INVITE_DEFAULT_QUOTA`.
   * @param params Параметры создания.
   * @returns Созданный аккаунт.
   * @throws {LoginTakenError} Если логин уже занят.
   */
  public async createAccount(params: CreateAccountParams): Promise<AccountFull> {
    const { login, alias, password, registrationSource } = params;

    // Дружелюбная предпроверка; настоящий гард — UNIQUE(lower(login)) в БД.
    // TODO: Claude Code: 2026-06-04: гонка — два параллельных register с одним
    // логином оба проходят existsByLoginNormalized, второй упадёт на
    // UNIQUE(lower(login)) → сейчас 500. Поймать unique-violation (pg 23505) в
    // AccountRepository.create и бросить LoginTakenError (409).
    if (await this._accountRepository.existsByLoginNormalized(login.normalized)) {
      throw new LoginTakenError('Логин уже занят.');
    }

    const passwordHash = await this._hashService.hash(password.value);
    const id = generateId();
    const invitesRemaining = this._configService.get('INVITE_DEFAULT_QUOTA', { infer: true });

    return this._accountRepository.create(id, {
      login: login.value,
      alias: alias.value,
      avatar: null,
      passwordHash,
      registrationSource,
      invitesRemaining,
      recoveryRequiredCount: null,
      timezone: 'UTC',
    });
  }
}

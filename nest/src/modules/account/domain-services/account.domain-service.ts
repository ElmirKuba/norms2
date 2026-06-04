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
import { BadCredentialsError } from '../../../shared/errors/bad-credentials.error';
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

  /**
   * Аутентификация по логину+паролю. Логин/пароль — сырые строки (на входе НЕ
   * валидируем формат VO, чтобы любые неверные данные давали единый 401, а не
   * 400). Вход разрешён ⇔ не удалён и не деактивирован (бан — на I2).
   * @param loginRaw Логин (любой регистр).
   * @param passwordRaw Пароль-плейнтекст.
   * @returns Аккаунт при успехе.
   * @throws {BadCredentialsError} Неверные данные или вход запрещён.
   */
  public async authenticate(loginRaw: string, passwordRaw: string): Promise<AccountFull> {
    const account = await this._accountRepository.findByLoginNormalized(loginRaw.toLowerCase());
    if (account === null) {
      throw new BadCredentialsError('Неверный логин или пароль.');
    }
    const passwordOk = await this._hashService.verify(account.passwordHash, passwordRaw);
    if (!passwordOk) {
      throw new BadCredentialsError('Неверный логин или пароль.');
    }
    // TODO: Claude Code: 2026-06-04: бан-чек login-allowed — EXISTS active ban
    // (нужен bans-репозиторий, этап I2). Сейчас проверяем только deleted/deactivated.
    if (account.deletedAt !== null || account.deactivatedAt !== null) {
      throw new BadCredentialsError('Неверный логин или пароль.');
    }
    return account;
  }

  /**
   * Возвращает аккаунт по id, только если вход разрешён (для Guard на каждом
   * защищённом запросе — чтобы деактивация/бан действовали в окне access-токена).
   * @param id Идентификатор аккаунта (из access-JWT).
   * @returns Активный аккаунт.
   * @throws {BadCredentialsError} Если аккаунт не найден или вход запрещён.
   */
  public async getActiveById(id: string): Promise<AccountFull> {
    const account = await this._accountRepository.findById(id);
    if (account === null) {
      throw new BadCredentialsError('Аккаунт не найден.');
    }
    // TODO: Claude Code: 2026-06-04: бан-чек (EXISTS active ban) — этап I2.
    if (account.deletedAt !== null || account.deactivatedAt !== null) {
      throw new BadCredentialsError('Вход запрещён.');
    }
    return account;
  }

  /**
   * Атомарно списывает 1 из квоты инвайтов (для кросс-домена из invites).
   * @param accountId Идентификатор аккаунта.
   * @returns true, если списано; false, если квота исчерпана.
   */
  public async consumeInviteQuota(accountId: string): Promise<boolean> {
    return this._accountRepository.decrementInvitesRemaining(accountId);
  }

  /**
   * Атомарно возвращает 1 в квоту инвайтов (отзыв/компенсация).
   * @param accountId Идентификатор аккаунта.
   * @returns Промис завершения.
   */
  public async returnInviteQuota(accountId: string): Promise<void> {
    await this._accountRepository.incrementInvitesRemaining(accountId);
  }
}

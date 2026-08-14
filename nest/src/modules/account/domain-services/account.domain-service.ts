import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ACCOUNT_REPOSITORY } from '../adapters/account-repository.port';
import { ROLE_REPOSITORY } from '../adapters/role-repository.port';
import type { RoleRepositoryPort } from '../adapters/role-repository.port';
import { ROLE_USER } from '../seed/roles.seed';
import type { AccountRepositoryPort } from '../adapters/account-repository.port';
import type { AccountFull } from '../interfaces/account-full.interface';
import type { AccountPublicView } from '../interfaces/account-public-view.interface';
import type { AccountRead } from '../interfaces/account-read.interface';
import type { Login } from '../value-objects/login.vo';
import type { Alias } from '../value-objects/alias.vo';
import type { Password } from '../value-objects/password.vo';
import { HashService } from '../../../shared/services/hash.service';
import { LoginTakenError } from '../../../shared/errors/login-taken.error';
import { BadCredentialsError } from '../../../shared/errors/bad-credentials.error';
import { AccountDeactivatedError } from '../../../shared/errors/account-deactivated.error';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { AccountMutable } from '../interfaces/account-mutable.interface';
import type { Transaction } from '../../../shared/transactions/transaction.interface';
import type { Env } from '../../../system/config/env.schema';

/** Узкая проекция аккаунта для recovery-флоу (без секретов). */
export interface RecoveryAccount {
  /** PK. */
  id: string;
  /** Сколько вопросов нужно ответить (K) или null (восстановление не настроено). */
  recoveryRequiredCount: number | null;
}

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
  private readonly _logger = new Logger(AccountDomainService.name);

  /**
   * @param _accountRepository Порт репозитория аккаунтов (DI-токен).
   * @param _hashService Хеш-сервис argon2id.
   * @param _configService Конфиг (квота инвайтов и пр.).
   */
  public constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly _accountRepository: AccountRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly _roleRepository: RoleRepositoryPort,
    private readonly _hashService: HashService,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

  /**
   * Создаёт аккаунт: проверяет занятость логина, хеширует пароль, генерит id,
   * пишет строку. Квота инвайтов — из `INVITE_DEFAULT_QUOTA`. При регистрации по
   * инвайту получает `tx` — INSERT идёт в общей транзакции с погашением кода.
   * @param params Параметры создания.
   * @param tx Опц. транзакция.
   * @returns Созданный аккаунт.
   * @throws {LoginTakenError} Если логин уже занят.
   */
  public async createAccount(params: CreateAccountParams, tx?: Transaction): Promise<AccountFull> {
    const { login, alias, password, registrationSource } = params;

    // Дружелюбная предпроверка; настоящий гард — UNIQUE(lower(login)) в БД. Гонку
    // (два параллельных register с одним логином: оба проходят предпроверку, второй
    // нарушит UNIQUE) ловит AccountRepository.create → LoginTakenError (409), не 500.
    if (await this._accountRepository.existsByLoginNormalized(login.normalized)) {
      throw new LoginTakenError('Логин уже занят.');
    }

    const passwordHash = await this._hashService.hash(password.value);
    const id = generateId();
    const invitesRemaining = this._configService.get('INVITE_DEFAULT_QUOTA', { infer: true });

    const account = await this._accountRepository.create(
      id,
      {
        login: login.value,
        alias: alias.value,
        avatar: null,
        passwordHash,
        registrationSource,
        invitesRemaining,
        recoveryRequiredCount: null,
        timezone: 'UTC',
      },
      tx,
    );

    await this._grantBaseRole(account.id, tx);
    return account;
  }

  /**
   * Выдаёт базовую роль только что созданному аккаунту (2.9.3).
   *
   * **Здесь, а не в use-case регистрации.** Аккаунты создаются несколькими путями — свободная
   * регистрация, регистрация по коду, будущие сценарии, — и роль, выдаваемая вызывающим,
   * однажды была бы забыта. В доменном сервисе её не может пропустить никто.
   *
   * **В той же транзакции**, что и сам аккаунт: аккаунт без роли — это аккаунт без прав, и
   * появляться порознь они не должны.
   *
   * **Отсутствие роли в справочнике не роняет регистрацию.** На пустой базе сид ролей ещё не
   * отработал; человек в этом случае получит роль догонялкой при ближайшем старте, и это
   * заметно лучше, чем отказ в регистрации из-за незаполненного справочника.
   *
   * @param accountId Кому.
   * @param tx Транзакция создания аккаунта.
   * @returns Промис завершения.
   */
  private async _grantBaseRole(accountId: string, tx?: Transaction): Promise<void> {
    const role = await this._roleRepository.findByCode(ROLE_USER);
    if (role === null) {
      this._logger.warn(
        `Базовая роль '${ROLE_USER}' не найдена — аккаунт ${accountId} получит её на старте.`,
      );
      return;
    }
    await this._roleRepository.grant(accountId, role.id, tx);
  }

  /**
   * Собирает проекцию профиля: снимает секрет и добавляет коды ролей (2.9.3·8).
   *
   * Одно место на все пять точек, где профиль уходит наружу, — иначе «а роли-то добавить»
   * однажды забудут в одной из них, и фронт получит аккаунт без ролей ровно там, где их ждал.
   *
   * ⚠️ Роли здесь — **подсказка интерфейсу**, а не право. Настоящая проверка на бэке
   * (`RolesGuard`, отказ 404): спрятанная кнопка защитой не является.
   *
   * @param account Полная строка аккаунта.
   * @returns Профиль без секрета, с ролями.
   */
  public async toRead(account: AccountFull): Promise<AccountRead> {
    const { passwordHash: _passwordHash, ...read } = account;
    return { ...read, roles: await this._roleRepository.codesOf(account.id) };
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
    // Бан-чек — НЕ здесь (account-домен про bans не знает): его делает
    // LoginAccountUseCase кросс-доменно (ADR-0038).
    // Про удалённых домен не знает и знать не должен (2.9.3·29.1): их не возвращает хранилище —
    // для бизнес-логики такого аккаунта просто нет, как если бы включили `paranoid` в ORM.
    // Деактивирован — другое дело: это состояние продукта, отдельный 403, чтобы фронт предложил
    // реактивацию (ADR-0017/0039).
    if (account.deactivatedAt !== null) {
      throw new AccountDeactivatedError('Аккаунт деактивирован.');
    }
    return account;
  }

  /**
   * Проверяет учётные данные для реактивации (деактивированный не проходит Guard,
   * поэтому путь — публичный по логину+паролю, ADR-0039). Деактивированный
   * допускается; удалённый — нет.
   * @param loginRaw Логин (любой регистр).
   * @param passwordRaw Пароль-плейнтекст.
   * @returns Аккаунт (возможно деактивированный).
   * @throws {BadCredentialsError} Неверные данные или аккаунт удалён.
   */
  public async authenticateForReactivation(loginRaw: string, passwordRaw: string): Promise<AccountFull> {
    const account = await this._accountRepository.findByLoginNormalized(loginRaw.toLowerCase());
    if (account === null) {
      throw new BadCredentialsError('Неверный логин или пароль.');
    }
    const passwordOk = await this._hashService.verify(account.passwordHash, passwordRaw);
    if (!passwordOk) {
      throw new BadCredentialsError('Неверный логин или пароль.');
    }
    return account;
  }

  /**
   * Деактивирует аккаунт (обратимая пауза по желанию, ADR-0017) — CAS.
   * @param accountId Идентификатор аккаунта.
   * @returns Промис завершения.
   */
  public async deactivate(accountId: string): Promise<void> {
    await this._applyWithRetry(accountId, { deactivatedAt: new Date() });
  }

  /**
   * Реактивирует аккаунт (снимает паузу) — CAS.
   * @param accountId Идентификатор аккаунта.
   * @returns Промис завершения.
   */
  public async reactivate(accountId: string): Promise<void> {
    await this._applyWithRetry(accountId, { deactivatedAt: null });
  }

  /**
   * Удаляет аккаунт со всеми его данными.
   *
   * **Домен считает, что удалил — и это правда для продукта** ([ADR-0068](../../../../docs/decisions/0068-deletion-belongs-to-storage.md),
   * реш. Elmir 14.08.2026). Уходят привычки, цели, «держусь», препятствия, микро-победы,
   * сессии, секретные вопросы и невыданные коды. Раньше здесь стояла метка `deleted_at` руками —
   * то есть домен сам решал, как хранилищу хранить, и при этом **не трогал ни одной строки
   * данных человека**: они оставались висеть на живом аккаунте.
   *
   * Дерево приглашений и баны переживают удаление: это связи с другими людьми, а не его данные
   * ([ADR-0017](../../../../docs/decisions/0017-account-soft-delete.md)).
   * @param accountId Идентификатор аккаунта.
   * @returns Промис завершения.
   */
  public async softDelete(accountId: string): Promise<void> {
    await this._accountRepository.delete(accountId);
  }

  /**
   * Число активных (не удалённых) пользователей — для overview (F4).
   * @returns Количество.
   */
  public async countActiveUsers(): Promise<number> {
    return this._accountRepository.countActive();
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
    // Бан-чек — НЕ здесь: его делает AuthGuard кросс-доменно (ADR-0038).
    if (account.deactivatedAt !== null) {
      throw new BadCredentialsError('Вход запрещён.');
    }
    return account;
  }

  /**
   * Атомарно списывает 1 из квоты инвайтов (для кросс-домена из invites).
   * @param accountId Идентификатор аккаунта.
   * @param tx Опц. транзакция (атомарность с созданием кода).
   * @returns true, если списано; false, если квота исчерпана.
   */
  public async consumeInviteQuota(accountId: string, tx?: Transaction): Promise<boolean> {
    return this._accountRepository.decrementInvitesRemaining(accountId, tx);
  }

  /**
   * Атомарно возвращает 1 в квоту инвайтов (отзыв кода).
   * @param accountId Идентификатор аккаунта.
   * @param tx Опц. транзакция (атомарность с отзывом кода).
   * @returns Промис завершения.
   */
  public async returnInviteQuota(accountId: string, tx?: Transaction): Promise<void> {
    await this._accountRepository.addInvitesRemaining(accountId, 1, tx);
  }

  /**
   * Начисляет аккаунту дополнительные приглашения (решение владельца по заявке, 2.9.1·13).
   *
   * Отличается от `returnInviteQuota` не числом, а смыслом: там квота **возвращается** своему
   * хозяину при отзыве кода, здесь **выдаётся сверх** положенного. Разные поводы — разные имена,
   * иначе в логике не отличить возврат от подарка.
   * @param accountId Идентификатор аккаунта.
   * @param amount Сколько выдать.
   * @param tx Опц. транзакция (атомарность с закрытием заявки).
   * @returns Новое значение квоты или null, если аккаунта нет.
   */
  public async grantInviteQuota(
    accountId: string,
    amount: number,
    tx?: Transaction,
  ): Promise<number | null> {
    return this._accountRepository.addInvitesRemaining(accountId, amount, tx);
  }

  /**
   * Сбрасывает пароль (восстановление по секретным вопросам, R1.5). Хеширует и
   * пишет через optimistic-CAS с retry (ADR-0035).
   * @param accountId Идентификатор аккаунта.
   * @param password Новый пароль (VO).
   * @returns Промис завершения.
   */
  public async resetPassword(accountId: string, password: Password): Promise<void> {
    const passwordHash = await this._hashService.hash(password.value);
    await this._applyWithRetry(accountId, { passwordHash });
  }

  /**
   * Устанавливает K (recovery_required_count). Диапазон `1 ≤ K ≤ N` валидирует
   * use-case (N — кросс-домен из recovery); здесь — только запись через CAS.
   * @param accountId Идентификатор аккаунта.
   * @param requiredCount Значение K.
   * @returns Промис завершения.
   */
  public async setRecoveryRequiredCount(accountId: string, requiredCount: number): Promise<void> {
    await this._applyWithRetry(accountId, { recoveryRequiredCount: requiredCount });
  }

  /**
   * Публичная проекция профиля по логину (для `GET /accounts/:login`). Удалённых
   * не показывает; деактивированные видны (пауза обратима, ADR-0017).
   * @param loginRaw Логин (любой регистр).
   * @returns Публичная проекция или null (нет/удалён).
   */
  public async getPublicByLogin(loginRaw: string): Promise<AccountPublicView | null> {
    const account = await this._accountRepository.findByLoginNormalized(loginRaw.toLowerCase());
    if (account === null) {
      return null;
    }
    return { id: account.id, login: account.login, alias: account.alias, avatar: account.avatar };
  }

  /**
   * Меняет псевдоним (профиль) через optimistic-CAS с retry (ADR-0035).
   * @param accountId Идентификатор аккаунта.
   * @param alias Новый псевдоним (VO).
   * @returns Обновлённый аккаунт.
   */
  public async updateAlias(accountId: string, alias: Alias): Promise<AccountFull> {
    return this._applyWithRetry(accountId, { alias: alias.value });
  }

  /**
   * Устанавливает/снимает путь аватарки (профиль) через optimistic-CAS. Файл на
   * диске пишет/удаляет use-case (account-домен про fs не знает).
   * @param accountId Идентификатор аккаунта.
   * @param avatar Относительный путь к файлу или null (снять).
   * @returns Обновлённый аккаунт.
   */
  public async setAvatar(accountId: string, avatar: string | null): Promise<AccountFull> {
    return this._applyWithRetry(accountId, { avatar });
  }

  /**
   * Находит аккаунт по логину для recovery-флоу (узкая проекция, без секретов).
   * Удалённые не возвращает.
   * @param loginRaw Логин (любой регистр).
   * @returns Проекция или null (нет/удалён).
   */
  public async findRecoveryAccountByLogin(loginRaw: string): Promise<RecoveryAccount | null> {
    const account = await this._accountRepository.findByLoginNormalized(loginRaw.toLowerCase());
    if (account === null) {
      return null;
    }
    return { id: account.id, recoveryRequiredCount: account.recoveryRequiredCount };
  }

  /**
   * Применяет изменения через optimistic-CAS с retry (перечитывает version при
   * конфликте, ADR-0035). Фикс. набор изменений, version берётся свежий каждый раз.
   * @param id Идентификатор аккаунта.
   * @param changes Изменяемые поля.
   * @returns Обновлённый аккаунт.
   * @throws {BadCredentialsError} Если аккаунт не найден.
   * @throws {Error} Если конфликт версий не разрешился за N попыток.
   */
  private async _applyWithRetry(id: string, changes: AccountMutable): Promise<AccountFull> {
    const attempts = this._configService.get('OPTIMISTIC_RETRY_ATTEMPTS', { infer: true });
    for (let attempt = 0; attempt < attempts; attempt++) {
      const account = await this._accountRepository.findById(id);
      if (account === null) {
        throw new BadCredentialsError('Аккаунт не найден.');
      }
      const updated = await this._accountRepository.updateWithVersion(id, account.version, changes);
      if (updated !== null) {
        return updated;
      }
    }
    throw new Error('Конфликт версий не разрешился за отведённое число попыток.');
  }
}

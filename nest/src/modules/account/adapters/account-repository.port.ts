import type { AccountFull } from '../interfaces/account-full.interface';
import type { AccountCreate } from '../interfaces/account-create.interface';
import type { AccountMutable } from '../interfaces/account-mutable.interface';

/** DI-токен порта репозитория аккаунтов (биндится на реализацию в account.module). */
export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

/**
 * Порт репозитория аккаунтов — контракт «что домену нужно от хранилища», БЕЗ ORM.
 * Домен-сервисы зависят от него (через DI-токен), не зная про Drizzle.
 * Реализация — `database/repositories/account` (A1.5); связка — `account.module` (A1.6).
 */
export interface AccountRepositoryPort {
  /**
   * Находит аккаунт по PK.
   * @param id Идентификатор аккаунта.
   * @returns Полная строка или null.
   */
  findById(id: string): Promise<AccountFull | null>;

  /**
   * Находит аккаунт по нормализованному (lower) логину — для входа.
   * @param loginNormalized Логин в нижнем регистре.
   * @returns Полная строка или null.
   */
  findByLoginNormalized(loginNormalized: string): Promise<AccountFull | null>;

  /**
   * Проверяет занятость логина (по lower) — для регистрации.
   * @param loginNormalized Логин в нижнем регистре.
   * @returns true, если логин уже занят.
   */
  existsByLoginNormalized(loginNormalized: string): Promise<boolean>;

  /**
   * Создаёт аккаунт (id генерит домен через generateId).
   * @param id Идентификатор аккаунта.
   * @param data Данные создания (Base).
   * @returns Созданная полная строка (с дефолтами БД).
   */
  create(id: string, data: AccountCreate): Promise<AccountFull>;

  /**
   * Optimistic-lock обновление профиля (CAS по version, ADR-0035).
   * @param id Идентификатор аккаунта.
   * @param expectedVersion Версия, прочитанная ранее.
   * @param changes Изменяемые поля.
   * @returns Обновлённая строка, или null при конфликте версий.
   */
  updateWithVersion(
    id: string,
    expectedVersion: number,
    changes: AccountMutable,
  ): Promise<AccountFull | null>;

  /**
   * Атомарно списывает 1 из квоты инвайтов (`WHERE invites_remaining > 0`).
   * @param id Идентификатор аккаунта.
   * @returns true, если списано; false, если квота исчерпана.
   */
  decrementInvitesRemaining(id: string): Promise<boolean>;

  /**
   * Атомарно возвращает 1 в квоту инвайтов (отзыв кода).
   * @param id Идентификатор аккаунта.
   * @returns Промис завершения.
   */
  incrementInvitesRemaining(id: string): Promise<void>;
}

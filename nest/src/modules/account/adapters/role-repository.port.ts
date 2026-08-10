import type { RoleFull } from '../interfaces/role-full.interface';

/** DI-токен порта репозитория ролей (биндится на реализацию в account.module). */
export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');

/**
 * Порт репозитория ролей (2.9.3) — контракт «что домену нужно от хранилища», БЕЗ ORM.
 *
 * Роль здесь — строка справочника, а не значение enum: добавить новую = добавить строку.
 * Связь с аккаунтом — многие-ко-многим (человек может быть и пользователем, и админом).
 */
export interface RoleRepositoryPort {
  /**
   * Заводит роль, если её ещё нет (идемпотентно по `code`).
   * @param role Код, название и описание.
   * @returns Строка справочника — созданная или уже существовавшая.
   */
  ensureRole(role: { code: string; title: string; description: string | null }): Promise<RoleFull>;

  /**
   * Находит роль по машинному коду (без учёта регистра).
   * @param code Код роли (`admin`, `user`).
   * @returns Строка справочника или null.
   */
  findByCode(code: string): Promise<RoleFull | null>;

  /**
   * Выдаёт роль аккаунту; повторная выдача ничего не меняет.
   * @param accountId Кому.
   * @param roleId Какую.
   * @returns true, если роль была выдана именно сейчас.
   */
  grant(accountId: string, roleId: string): Promise<boolean>;

  /**
   * Коды ролей аккаунта — то, по чему проверяются права.
   * @param accountId Чьи роли.
   * @returns Коды в нижнем регистре; пустой массив, если ролей нет.
   */
  codesOf(accountId: string): Promise<string[]>;

  /**
   * Идентификаторы аккаунтов, у которых ещё нет указанной роли, — для разовой досыпки.
   * @param roleId Роль, которой не хватает.
   * @returns Идентификаторы аккаунтов.
   */
  accountsWithoutRole(roleId: string): Promise<string[]>;
}

import type { Transaction } from '../../../shared/transactions/transaction.interface';
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
   *
   * Принимает транзакцию, потому что базовая роль выдаётся **вместе с созданием аккаунта**:
   * аккаунт без роли — это аккаунт без прав, и появляться порознь они не должны.
   *
   * @param accountId Кому.
   * @param roleId Какую.
   * @param tx Опц. транзакция вызывающего.
   * @returns true, если роль была выдана именно сейчас.
   */
  grant(accountId: string, roleId: string, tx?: Transaction): Promise<boolean>;

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

  /**
   * Аккаунты с указанной ролью — по её коду (2.9.3·3а).
   *
   * По коду, а не по `id`, потому что зовущему известен именно код (`admin`): иначе каждый
   * вызывающий сначала искал бы роль, а потом её носителей, и забытая проверка на `null`
   * молча превращалась бы в «админов нет».
   *
   * @param code Код роли, регистр не важен.
   * @returns Идентификаторы аккаунтов.
   */
  accountIdsByRoleCode(code: string): Promise<string[]>;
}

import type { SecretQaFull } from '../interfaces/secret-qa-full.interface';
import type { SecretQaCreate } from '../interfaces/secret-qa-create.interface';

/** DI-токен порта репозитория секретных вопросов (биндится в recovery.module). */
export const SECRET_QA_REPOSITORY = Symbol('SECRET_QA_REPOSITORY');

/**
 * Порт репозитория секретных вопросов (1:N к accounts, ADR-0008), БЕЗ ORM. Хеш
 * ответа считает домен; репозиторий хранит/читает строки. Реализация — Drizzle.
 */
export interface SecretQaRepositoryPort {
  /**
   * Добавляет вопрос.
   * @param id Идентификатор (генерит домен).
   * @param data Данные (accountId/question/answerHash).
   * @returns Созданная строка.
   */
  add(id: string, data: SecretQaCreate): Promise<SecretQaFull>;

  /**
   * Вопросы аккаунта.
   * @param accountId Владелец.
   * @returns Строки (новые сверху).
   */
  listByAccount(accountId: string): Promise<SecretQaFull[]>;

  /**
   * Удаляет СВОЙ вопрос (по id+владельцу).
   * @param id Идентификатор вопроса.
   * @param accountId Владелец (должен совпасть).
   * @returns true, если удалён.
   */
  removeOwn(id: string, accountId: string): Promise<boolean>;

  /**
   * Сколько вопросов у аккаунта (для валидации `K ≤ N`).
   * @param accountId Владелец.
   * @returns Количество.
   */
  countByAccount(accountId: string): Promise<number>;

  /**
   * Вопросы аккаунта по набору id (для сверки ответов при восстановлении —
   * гарантирует принадлежность владельцу). Пустой `ids` → пустой результат.
   * @param ids Идентификаторы вопросов.
   * @param accountId Владелец.
   * @returns Найденные строки этого владельца.
   */
  findByIdsForAccount(ids: string[], accountId: string): Promise<SecretQaFull[]>;
}

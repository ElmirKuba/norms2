import type { SessionFull } from '../interfaces/session-full.interface';
import type { SessionCreate } from '../interfaces/session-create.interface';

/** DI-токен порта репозитория сессий. */
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

/**
 * Порт репозитория сессий (refresh-токены/устройства), БЕЗ ORM.
 * Реализация — `database/repositories/session` (Drizzle). Ротация — CAS по
 * token_hash (ADR-0035).
 */
export interface SessionRepositoryPort {
  /**
   * Создаёт сессию.
   * @param id Идентификатор.
   * @param data Данные сессии.
   * @returns Созданная сессия.
   */
  create(id: string, data: SessionCreate): Promise<SessionFull>;

  /**
   * Находит сессию по хешу токена.
   * @param tokenHash SHA-256 refresh-токена.
   * @returns Сессия или null.
   */
  findByTokenHash(tokenHash: string): Promise<SessionFull | null>;

  /**
   * CAS-ротация: меняет token_hash и срок только если текущий хеш совпал и
   * сессия не отозвана (ADR-0035).
   * @param id Идентификатор сессии.
   * @param oldTokenHash Ожидаемый текущий хеш.
   * @param newTokenHash Новый хеш.
   * @param newExpiresAt Новый срок.
   * @returns Обновлённая сессия или null при несовпадении/отзыве.
   */
  rotate(
    id: string,
    oldTokenHash: string,
    newTokenHash: string,
    newExpiresAt: Date,
  ): Promise<SessionFull | null>;

  /**
   * Отзывает сессию по id (logout).
   * @param id Идентификатор сессии.
   * @returns Промис завершения.
   */
  revokeById(id: string): Promise<void>;

  /**
   * Отзывает все активные сессии аккаунта (reuse-detect / logout-all).
   * @param accountId Идентификатор аккаунта.
   * @returns Промис завершения.
   */
  revokeAllByAccount(accountId: string): Promise<void>;
}

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
   * сессия не отозвана (ADR-0035). Атомарно (одна транзакция) архивирует старый
   * хеш в session_token_history → реплей ротированного токена ловится потом
   * `findHistoricalTokenOwner` (reuse-detect с грейсом, 2.5.2).
   * @param id Идентификатор сессии.
   * @param oldTokenHash Ожидаемый текущий хеш (уйдёт в архив).
   * @param newTokenHash Новый хеш.
   * @param newExpiresAt Новый срок.
   * @param historyId Идентификатор архивной записи (генерит домен).
   * @returns Обновлённая сессия или null при несовпадении/отзыве.
   */
  rotate(
    id: string,
    oldTokenHash: string,
    newTokenHash: string,
    newExpiresAt: Date,
    historyId: string,
  ): Promise<SessionFull | null>;

  /**
   * Владелец архивного (уже ротированного) хеша токена + время архивации — для
   * reuse-detect с грейс-окном (2.5.2): по `archivedAt` домен отличает benign-гонку
   * двойного refresh (в пределах грейса → мягкий отказ без отзыва) от реального
   * реплея украденного токена (вне грейса → отзыв ТОЛЬКО этой сессии, не аккаунта).
   * @param tokenHash SHA-256 предъявленного токена.
   * @returns `{ sessionId, accountId, archivedAt }` или null.
   */
  findHistoricalTokenOwner(
    tokenHash: string,
  ): Promise<{ sessionId: string; accountId: string; archivedAt: Date } | null>;

  /**
   * Отзывает сессию по id (logout).
   * @param id Идентификатор сессии.
   * @returns Промис завершения.
   */
  revokeById(id: string): Promise<void>;

  /**
   * Активные сессии аккаунта (не отозваны и не истекли) — список устройств.
   * @param accountId Идентификатор аккаунта.
   * @returns Активные сессии (новые сверху).
   */
  listActiveByAccount(accountId: string): Promise<SessionFull[]>;

  /**
   * Жива ли сессия по id (есть, не отозвана, не истекла) — для Guard (ADR-0043).
   * @param id Идентификатор сессии (sid из access-токена).
   * @returns true, если активна.
   */
  existsActiveById(id: string): Promise<boolean>;

  /**
   * Отзывает СВОЮ активную сессию (id + владелец) — отзыв конкретного устройства.
   * @param id Идентификатор сессии.
   * @param accountId Владелец (должен совпасть).
   * @returns true, если отозвана (была своя и активная).
   */
  revokeByIdForAccount(id: string, accountId: string): Promise<boolean>;

  /**
   * Отзывает все активные сессии аккаунта, КРОМЕ одной (revoke-others — выйти на
   * остальных устройствах, оставив текущее).
   * @param accountId Идентификатор аккаунта.
   * @param exceptId Сессия, которую НЕ отзывать (текущая).
   * @returns Промис завершения.
   */
  revokeAllByAccountExcept(accountId: string, exceptId: string): Promise<void>;

  /**
   * Отзывает все активные сессии аккаунта (reuse-detect / logout-all).
   * @param accountId Идентификатор аккаунта.
   * @returns Промис завершения.
   */
  revokeAllByAccount(accountId: string): Promise<void>;
}

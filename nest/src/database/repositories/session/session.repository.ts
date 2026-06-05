import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { sessions } from '../../schemas/sessions.schema';
import type { SessionRepositoryPort } from '../../../modules/sessions/adapters/session-repository.port';
import type { SessionCreate } from '../../../modules/sessions/interfaces/session-create.interface';
import type { SessionFull } from '../../../modules/sessions/interfaces/session-full.interface';

/**
 * Drizzle-реализация порта сессий. Строка sessions структурно совпадает с
 * SessionFull (без union-колонок), поэтому маппинг — прямой возврат строки.
 */
@Injectable()
export class SessionRepository implements SessionRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Создаёт сессию.
   * @param id Идентификатор.
   * @param data Данные сессии.
   * @returns Созданная сессия.
   * @throws {Error} Если INSERT не вернул строку.
   */
  public async create(id: string, data: SessionCreate): Promise<SessionFull> {
    const rows = await this._db
      .insert(sessions)
      .values({ id, ...data })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT sessions не вернул строку.');
    }
    return row;
  }

  /**
   * Находит сессию по хешу токена (индекс token_hash).
   * @param tokenHash SHA-256 refresh-токена.
   * @returns Сессия или null.
   */
  public async findByTokenHash(tokenHash: string): Promise<SessionFull | null> {
    const rows = await this._db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * CAS-ротация token_hash (только если хеш совпал и сессия не отозвана).
   * @param id Идентификатор сессии.
   * @param oldTokenHash Ожидаемый текущий хеш.
   * @param newTokenHash Новый хеш.
   * @param newExpiresAt Новый срок.
   * @returns Обновлённая сессия или null.
   */
  public async rotate(
    id: string,
    oldTokenHash: string,
    newTokenHash: string,
    newExpiresAt: Date,
  ): Promise<SessionFull | null> {
    const rows = await this._db
      .update(sessions)
      .set({ tokenHash: newTokenHash, expiresAt: newExpiresAt })
      .where(and(eq(sessions.id, id), eq(sessions.tokenHash, oldTokenHash), isNull(sessions.revokedAt)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Активные сессии аккаунта (не отозваны и не истекли), новые сверху.
   * @param accountId Идентификатор аккаунта.
   * @returns Активные сессии.
   */
  public async listActiveByAccount(accountId: string): Promise<SessionFull[]> {
    return this._db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.accountId, accountId),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(sessions.createdAt));
  }

  /**
   * Отзывает сессию по id (если ещё активна).
   * @param id Идентификатор сессии.
   * @returns Промис завершения.
   */
  public async revokeById(id: string): Promise<void> {
    await this._db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)));
  }

  /**
   * Отзывает свою активную сессию (id + владелец).
   * @param id Идентификатор сессии.
   * @param accountId Владелец.
   * @returns true, если отозвана.
   */
  public async revokeByIdForAccount(id: string, accountId: string): Promise<boolean> {
    const rows = await this._db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, id), eq(sessions.accountId, accountId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  /**
   * Отзывает все активные сессии аккаунта.
   * @param accountId Идентификатор аккаунта.
   * @returns Промис завершения.
   */
  public async revokeAllByAccount(accountId: string): Promise<void> {
    await this._db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)));
  }
}

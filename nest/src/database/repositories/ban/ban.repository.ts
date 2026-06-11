import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { bans } from '../../schemas/bans.schema';
import { accounts } from '../../schemas/accounts.schema';
import type { BanRepositoryPort } from '../../../modules/bans/adapters/ban-repository.port';
import type { BanCreate } from '../../../modules/bans/interfaces/ban-create.interface';
import type { BanFull } from '../../../modules/bans/interfaces/ban-full.interface';
import type { BanListItem } from '../../../modules/bans/interfaces/ban-list-item.interface';
import type { ActiveBanDetail } from '../../../modules/bans/interfaces/active-ban-detail.interface';

/**
 * Drizzle-реализация порта банов (единственное место, где про ORM знают). Строки
 * структурно совпадают с BanFull (колонки 1:1) → маппинг прямой. Идемпотентный
 * createBan — через ON CONFLICT по partial-unique активной пары.
 */
@Injectable()
export class BanRepository implements BanRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Создаёт бан; при коллизии с активной записью пары обновляет причину
   * (идемпотентность повторного бана; параллельный двойной бан — один выигрывает).
   * Снятый ранее бан остаётся как история, новая активная строка добавляется.
   * @param id Идентификатор.
   * @param data Данные (banner/target/reason).
   * @returns Актуальная активная запись.
   * @throws {Error} Если запрос не вернул строку.
   */
  public async createBan(id: string, data: BanCreate): Promise<BanFull> {
    const rows = await this._db
      .insert(bans)
      .values({ id, bannerId: data.bannerId, targetId: data.targetId, reason: data.reason })
      .onConflictDoUpdate({
        target: [bans.bannerId, bans.targetId],
        targetWhere: sql`${bans.active}`,
        set: { reason: data.reason, updatedAt: new Date() },
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('INSERT bans не вернул строку.');
    }
    return row;
  }

  /**
   * Деактивирует свою активную запись.
   * @param banId Идентификатор записи.
   * @param bannerId Владелец.
   * @returns true, если деактивирована.
   */
  public async deactivateOwn(banId: string, bannerId: string): Promise<boolean> {
    const rows = await this._db
      .update(bans)
      .set({ active: false })
      .where(and(eq(bans.id, banId), eq(bans.bannerId, bannerId), eq(bans.active, true)))
      .returning({ id: bans.id });
    return rows.length > 0;
  }

  /**
   * Есть ли активный бан на цель.
   * @param targetId Идентификатор цели.
   * @returns true, если есть.
   */
  public async existsActiveByTarget(targetId: string): Promise<boolean> {
    const rows = await this._db
      .select({ id: bans.id })
      .from(bans)
      .where(and(eq(bans.targetId, targetId), eq(bans.active, true)))
      .limit(1);
    return rows.length > 0;
  }

  /**
   * Активные баны на цель с именем банившего (INNER JOIN accounts по bannerId) —
   * для экрана «вы забанены»: кто/за что (ADR-0012).
   * @param targetId Идентификатор цели.
   * @returns Активные баны с login/alias банившего.
   */
  public async listActiveByTarget(targetId: string): Promise<ActiveBanDetail[]> {
    return this._db
      .select({
        bannerId: bans.bannerId,
        bannerLogin: accounts.login,
        bannerAlias: accounts.alias,
        reason: bans.reason,
      })
      .from(bans)
      .innerJoin(accounts, eq(accounts.id, bans.bannerId))
      .where(and(eq(bans.targetId, targetId), eq(bans.active, true)));
  }

  /**
   * Баны данного банившего (вкл. снятые), новые сверху. INNER JOIN accounts за
   * login/alias цели (проекция BanListItem для списка «мои баны»).
   * @param bannerId Идентификатор банившего.
   * @returns Проекции банов с именем цели.
   */
  public async listByBanner(bannerId: string): Promise<BanListItem[]> {
    return this._db
      .select({
        id: bans.id,
        targetId: bans.targetId,
        targetLogin: accounts.login,
        targetAlias: accounts.alias,
        reason: bans.reason,
        active: bans.active,
        createdAt: bans.createdAt,
      })
      .from(bans)
      .innerJoin(accounts, eq(accounts.id, bans.targetId))
      .where(eq(bans.bannerId, bannerId))
      .orderBy(desc(bans.createdAt));
  }

  /**
   * Активные баны на множество целей (overview-полезность, F4). Пустой список —
   * сразу [] (без запроса). Возвращает {targetId, bannerId} по каждой активной
   * записи — use-case делит на «забанено мной» и «забанено вышестоящим».
   * @param targetIds Идентификаторы целей.
   * @returns Пары цель→банивший активных банов.
   */
  public async listActiveBansForTargets(
    targetIds: string[],
  ): Promise<Pick<BanFull, 'targetId' | 'bannerId'>[]> {
    if (targetIds.length === 0) {
      return [];
    }
    return this._db
      .select({ targetId: bans.targetId, bannerId: bans.bannerId })
      .from(bans)
      .where(and(eq(bans.active, true), inArray(bans.targetId, targetIds)));
  }
}

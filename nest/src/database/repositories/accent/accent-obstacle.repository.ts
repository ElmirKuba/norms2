import { Inject, Injectable } from '@nestjs/common';
import { deleteCascade } from '../../core/deletion.engine';
import { alive } from '../../core/alive.util';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { obstacles } from '../../schemas/obstacles.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentObstacleRepositoryPort,
  ObstacleCreateData,
  ObstacleUpdateData,
} from '../../../modules/accent/obstacles/adapters/accent-obstacle-repository.port';
import type { ObstacleFull } from '../../../modules/accent/obstacles/interfaces/obstacle-full.interface';

/**
 * Drizzle-реализация порта препятствий (единственное место с ORM). Строка `obstacles`
 * структурно совпадает с `ObstacleFull` (колонки 1:1) → маппинг прямой. Всё скоупится по
 * `account_id`. Биндится на `ACCENT_OBSTACLE_REPOSITORY`.
 */
@Injectable()
export class AccentObstacleRepository implements AccentObstacleRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Препятствия аккаунта в ручном порядке (position, затем created_at, тай-брейкер id —
   * детерминизм при равных позициях, как у остальных трекеров).
   * @param accountId Идентификатор аккаунта.
   * @param archived `false` (умолчание) — в работе, `true` — архив (ADR-0068: два состояния,
   * оба видимые).
   * @returns Список препятствий владельца.
   */
  public async listByAccount(accountId: string, archived: boolean = false): Promise<ObstacleFull[]> {
    return this._db
      .select()
      .from(obstacles)
      .where(
        and(
          alive(obstacles),
          eq(obstacles.accountId, accountId),
          eq(obstacles.isActive, !archived),
        ),
      )
      .orderBy(asc(obstacles.position), asc(obstacles.createdAt), asc(obstacles.id));
  }

  /**
   * Находит препятствие по id с проверкой владения.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  public async findOwned(id: string, accountId: string): Promise<ObstacleFull | null> {
    const rows = await this._db
      .select()
      .from(obstacles)
      .where(and(alive(obstacles), eq(obstacles.id, id), eq(obstacles.accountId, accountId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Считает активные препятствия аккаунта (для мягкого фокус-лимита, ADR-0062 п.8).
   * Примеры-витрины (`is_starter`) не считаем: человек их ещё не выбирал.
   * @param accountId Идентификатор аккаунта.
   * @returns Число активных.
   */
  public async countActive(accountId: string): Promise<number> {
    const rows = await this._db
      .select({ value: count() })
      .from(obstacles)
      .where(and(alive(obstacles),
        and(
          eq(obstacles.accountId, accountId),
          eq(obstacles.isActive, true),
          eq(obstacles.isStarter, false),
        ),
      ));
    return rows[0]?.value ?? 0;
  }

  /**
   * Создаёт препятствие (id — `generateId()`, `position` = max+1 внутри аккаунта → в конец).
   * @param data Данные создания.
   * @returns Созданное препятствие.
   * @throws {Error} Если insert не вернул строку.
   */
  public async create(data: ObstacleCreateData): Promise<ObstacleFull> {
    const rows = await this._db
      .insert(obstacles)
      .values({
        id: generateId(),
        accountId: data.accountId,
        name: data.name,
        type: data.type,
        domainKey: data.domainKey ?? null,
        trigger: data.trigger ?? null,
        symptoms: data.symptoms ?? null,
        intensity: data.intensity ?? 3,
        isActive: true,
        isStarter: data.isStarter ?? false,
        position: sql<number>`(select coalesce(max(${obstacles.position}), -1) + 1 from ${obstacles} where ${obstacles.accountId} = ${data.accountId})`,
      })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new Error('Не удалось создать препятствие.');
    }
    return created;
  }

  /**
   * Массовое создание (сев стартового пака, ADR-0051). Позиции продолжают текущий максимум:
   * подзапрос вычисляется для каждой строки, поэтому пак ложится в конец списка.
   * @param items Данные создания.
   * @returns Число созданных строк.
   */
  public async createMany(items: readonly ObstacleCreateData[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }
    const values = items.map((data) => ({
      id: generateId(),
      accountId: data.accountId,
      name: data.name,
      type: data.type,
      domainKey: data.domainKey ?? null,
      trigger: data.trigger ?? null,
      symptoms: data.symptoms ?? null,
      intensity: data.intensity ?? 3,
      isActive: true,
      isStarter: data.isStarter ?? false,
      position: sql<number>`(select coalesce(max(${obstacles.position}), -1) + 1 from ${obstacles} where ${obstacles.accountId} = ${data.accountId})`,
    }));
    const rows = await this._db.insert(obstacles).values(values).returning({ id: obstacles.id });
    return rows.length;
  }

  /**
   * Удаляет непринятые примеры (`is_starter=true`); присвоенные не трогает (ADR-0051).
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  public async deleteStarters(accountId: string): Promise<number> {
    return this._db.transaction(async (transaction) => {
      const removed = await deleteCascade(
        transaction,
        obstacles,
        and(eq(obstacles.accountId, accountId), eq(obstacles.isStarter, true)),
        { force: true },
      );
      return removed;
    });
  }

  /**
   * Обновляет препятствие владельца (частично). Любой update bump'ает `version` (ADR-0035):
   * колонка ведётся с самого начала, чтобы включение строгого CAS позже не требовало миграции.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  public async update(
    id: string,
    accountId: string,
    patch: ObstacleUpdateData,
  ): Promise<ObstacleFull | null> {
    const rows = await this._db
      .update(obstacles)
      .set({ ...patch, version: sql`${obstacles.version} + 1` })
      .where(and(alive(obstacles), eq(obstacles.id, id), eq(obstacles.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Полностью удаляет препятствие владельца (контрмеры и журнал — каскадом; ссылки из
   * `anti_habit_events` обнуляются SET NULL).
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns true если удалено.
   */
  public async delete(id: string, accountId: string): Promise<boolean> {
    return this._db.transaction(async (transaction) => {
      const removed = await deleteCascade(
        transaction,
        obstacles,
        and(alive(obstacles), eq(obstacles.id, id), eq(obstacles.accountId, accountId)),
      );
      return removed > 0;
    });
  }

  /**
   * Ручная сортировка (ADR-0054): одним `UPDATE … FROM (VALUES …)` пишет `position = индекс`
   * для своих id. Чужие id отфильтровываются условием по `account_id`.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок (сверху вниз).
   */
  public async reorder(accountId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const tuples = ids.map((id, i) => sql`(${id}, ${i})`);
    await this._db.execute(sql`
      UPDATE ${obstacles} AS o SET position = v.pos::int
      FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(id, pos)
      WHERE o.id = v.id AND o.account_id = ${accountId}
    `);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { deleteCascade } from '../../core/deletion.engine';
import { alive } from '../../core/alive.util';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { counterplays } from '../../schemas/counterplays.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentCounterplayRepositoryPort,
  CounterplayCreateData,
  CounterplayUpdateData,
} from '../../../modules/accent/obstacles/adapters/accent-counterplay-repository.port';
import type { CounterplayFull } from '../../../modules/accent/obstacles/interfaces/counterplay-full.interface';

/**
 * Drizzle-реализация порта контрмер (единственное место с ORM). Строка `counterplays`
 * структурно совпадает с `CounterplayFull` → маппинг прямой. Скоуп — по `obstacle_id`
 * (владение препятствием проверяет domain-service выше). Биндится на
 * `ACCENT_COUNTERPLAY_REPOSITORY`.
 */
@Injectable()
export class AccentCounterplayRepository implements AccentCounterplayRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Контрмеры препятствия в ручном порядке (position → created_at → id).
   * @param obstacleId Идентификатор препятствия.
   * @returns Список контрмер.
   */
  public async listByObstacle(obstacleId: string): Promise<CounterplayFull[]> {
    return this._db
      .select()
      .from(counterplays)
      .where(and(alive(counterplays), eq(counterplays.obstacleId, obstacleId)))
      .orderBy(asc(counterplays.position), asc(counterplays.createdAt), asc(counterplays.id));
  }

  /**
   * Считает контрмеры для набора препятствий одним запросом (без N+1) — источник
   * `counterplaysCount` в списке.
   * @param obstacleIds Идентификаторы препятствий.
   * @returns Карта `obstacleId → число контрмер`.
   */
  public async countByObstacles(obstacleIds: readonly string[]): Promise<Map<string, number>> {
    if (obstacleIds.length === 0) {
      return new Map();
    }
    const rows = await this._db
      .select({ obstacleId: counterplays.obstacleId, value: count() })
      .from(counterplays)
      .where(and(alive(counterplays), inArray(counterplays.obstacleId, [...obstacleIds])))
      .groupBy(counterplays.obstacleId);
    return new Map(rows.map((row) => [row.obstacleId, row.value]));
  }

  /**
   * Находит контрмеру в пределах препятствия.
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @returns Строка или null.
   */
  public async findInObstacle(id: string, obstacleId: string): Promise<CounterplayFull | null> {
    const rows = await this._db
      .select()
      .from(counterplays)
      .where(and(alive(counterplays), eq(counterplays.id, id), eq(counterplays.obstacleId, obstacleId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Считает контрмеры одного препятствия (жёсткий лимит).
   * @param obstacleId Идентификатор препятствия.
   * @returns Число контрмер.
   */
  public async countInObstacle(obstacleId: string): Promise<number> {
    const rows = await this._db
      .select({ value: count() })
      .from(counterplays)
      .where(and(alive(counterplays), eq(counterplays.obstacleId, obstacleId)));
    return rows[0]?.value ?? 0;
  }

  /**
   * Создаёт контрмеру (id — `generateId()`, `position` = max+1 внутри препятствия).
   * @param data Данные создания.
   * @returns Созданная контрмера.
   * @throws {Error} Если insert не вернул строку.
   */
  public async create(data: CounterplayCreateData): Promise<CounterplayFull> {
    const rows = await this._db
      .insert(counterplays)
      .values({
        id: generateId(),
        obstacleId: data.obstacleId,
        text: data.text,
        linkedMicroWinId: data.linkedMicroWinId ?? null,
        position: sql<number>`(select coalesce(max(${counterplays.position}), -1) + 1 from ${counterplays} where ${counterplays.obstacleId} = ${data.obstacleId})`,
      })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new Error('Не удалось создать контрмеру.');
    }
    return created;
  }

  /**
   * Массовое создание (сев стартового пака с готовыми ответами, ADR-0051).
   * @param items Данные создания.
   * @returns Число созданных строк.
   */
  public async createMany(items: readonly CounterplayCreateData[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }
    const values = items.map((data) => ({
      id: generateId(),
      obstacleId: data.obstacleId,
      text: data.text,
      linkedMicroWinId: data.linkedMicroWinId ?? null,
      position: sql<number>`(select coalesce(max(${counterplays.position}), -1) + 1 from ${counterplays} where ${counterplays.obstacleId} = ${data.obstacleId})`,
    }));
    const rows = await this._db
      .insert(counterplays)
      .values(values)
      .returning({ id: counterplays.id });
    return rows.length;
  }

  /**
   * Обновляет контрмеру в пределах препятствия.
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null.
   */
  public async update(
    id: string,
    obstacleId: string,
    patch: CounterplayUpdateData,
  ): Promise<CounterplayFull | null> {
    const rows = await this._db
      .update(counterplays)
      .set(patch)
      .where(and(alive(counterplays), eq(counterplays.id, id), eq(counterplays.obstacleId, obstacleId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Удаляет контрмеру в пределах препятствия (ссылки из журнала обнуляются SET NULL).
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @returns true если удалено.
   */
  public async delete(id: string, obstacleId: string): Promise<boolean> {
    return this._db.transaction(async (transaction) => {
      const removed = await deleteCascade(
        transaction,
        counterplays,
        and(alive(counterplays), eq(counterplays.id, id), eq(counterplays.obstacleId, obstacleId)),
      );
      return removed > 0;
    });
  }

  /**
   * Ручная сортировка контрмер внутри препятствия (ADR-0054), одним `UPDATE … FROM (VALUES …)`.
   * @param obstacleId Идентификатор препятствия.
   * @param ids Желаемый порядок (сверху вниз).
   */
  public async reorder(obstacleId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const tuples = ids.map((id, i) => sql`(${id}, ${i})`);
    await this._db.execute(sql`
      UPDATE ${counterplays} AS c SET position = v.pos::int
      FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(id, pos)
      WHERE c.id = v.id AND c.obstacle_id = ${obstacleId}
    `);
  }
}

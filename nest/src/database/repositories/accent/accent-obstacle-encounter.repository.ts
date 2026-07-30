import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { obstacleEncounters } from '../../schemas/obstacle-encounters.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentObstacleEncounterRepositoryPort,
  CounterplayEffectiveness,
  EncounterCreateData,
  EncounterListOptions,
} from '../../../modules/accent/obstacles/adapters/accent-obstacle-encounter-repository.port';
import type {
  EncounterOutcome,
  ObstacleEncounterFull,
} from '../../../modules/accent/obstacles/interfaces/obstacle-encounter-full.interface';

/**
 * Drizzle-реализация порта журнала столкновений (единственное место с ORM). Строка
 * `obstacle_encounters` структурно совпадает с `ObstacleEncounterFull` → маппинг прямой.
 * Скоуп — по `obstacle_id`. Биндится на `ACCENT_OBSTACLE_ENCOUNTER_REPOSITORY`.
 */
@Injectable()
export class AccentObstacleEncounterRepository implements AccentObstacleEncounterRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Записывает столкновение (id — `generateId()`).
   * @param data Данные записи.
   * @returns Созданная запись.
   * @throws {Error} Если insert не вернул строку.
   */
  public async insert(data: EncounterCreateData): Promise<ObstacleEncounterFull> {
    const rows = await this._db
      .insert(obstacleEncounters)
      .values({
        id: generateId(),
        obstacleId: data.obstacleId,
        occurredAt: data.occurredAt,
        counterplayId: data.counterplayId ?? null,
        outcome: data.outcome ?? null,
        note: data.note ?? null,
      })
      .returning();
    const created = rows[0];
    if (!created) {
      throw new Error('Не удалось записать столкновение.');
    }
    return created;
  }

  /**
   * Лента столкновений (новые→старые). Keyset по `(occurred_at, id)`: строго «раньше курсора»,
   * поэтому одинаковые миллисекунды не теряются и не дублируются при листании.
   * @param obstacleId Идентификатор препятствия.
   * @param opts Лимит и курсор.
   * @returns Записи страницы.
   */
  public async listByObstacle(
    obstacleId: string,
    opts: EncounterListOptions,
  ): Promise<ObstacleEncounterFull[]> {
    const base = eq(obstacleEncounters.obstacleId, obstacleId);
    const where =
      opts.cursor === null
        ? base
        : and(
            base,
            or(
              lt(obstacleEncounters.occurredAt, opts.cursor.occurredAt),
              and(
                eq(obstacleEncounters.occurredAt, opts.cursor.occurredAt),
                lt(obstacleEncounters.id, opts.cursor.id),
              ),
            ),
          );
    return this._db
      .select()
      .from(obstacleEncounters)
      .where(where)
      .orderBy(desc(obstacleEncounters.occurredAt), desc(obstacleEncounters.id))
      .limit(opts.limit);
  }

  /**
   * Находит запись в пределах препятствия.
   * @param id Идентификатор записи.
   * @param obstacleId Идентификатор препятствия.
   * @returns Запись или null.
   */
  public async findInObstacle(
    id: string,
    obstacleId: string,
  ): Promise<ObstacleEncounterFull | null> {
    const rows = await this._db
      .select()
      .from(obstacleEncounters)
      .where(and(eq(obstacleEncounters.id, id), eq(obstacleEncounters.obstacleId, obstacleId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Проставляет исход (единственный modify в append-only журнале).
   * @param id Идентификатор записи.
   * @param obstacleId Идентификатор препятствия.
   * @param outcome Исход.
   * @returns Обновлённая запись или null.
   */
  public async setOutcome(
    id: string,
    obstacleId: string,
    outcome: EncounterOutcome,
  ): Promise<ObstacleEncounterFull | null> {
    const rows = await this._db
      .update(obstacleEncounters)
      .set({ outcome })
      .where(and(eq(obstacleEncounters.id, id), eq(obstacleEncounters.obstacleId, obstacleId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Считает столкновения за окно для набора препятствий одним запросом (источник
   * `encountersLast30`).
   * @param obstacleIds Идентификаторы препятствий.
   * @param sinceMs Нижняя граница `occurred_at` (unix ms).
   * @returns Карта `obstacleId → число столкновений`.
   */
  public async countSince(
    obstacleIds: readonly string[],
    sinceMs: number,
  ): Promise<Map<string, number>> {
    if (obstacleIds.length === 0) {
      return new Map();
    }
    const rows = await this._db
      .select({ obstacleId: obstacleEncounters.obstacleId, value: count() })
      .from(obstacleEncounters)
      .where(
        and(
          inArray(obstacleEncounters.obstacleId, [...obstacleIds]),
          gte(obstacleEncounters.occurredAt, sinceMs),
        ),
      )
      .groupBy(obstacleEncounters.obstacleId);
    return new Map(rows.map((row) => [row.obstacleId, row.value]));
  }

  /**
   * Действенность контрмер препятствия. `ratedCount` — применения с непустым `outcome`;
   * `helpedCount` — только `helped`. Неоценённые записи в знаменатель не идут (ADR-0062 п.6):
   * «не отмечено» не должно выглядеть как «не помогло».
   * @param obstacleId Идентификатор препятствия.
   * @returns Строки по контрмерам с хотя бы одним оценённым применением.
   */
  public async effectivenessByObstacle(obstacleId: string): Promise<CounterplayEffectiveness[]> {
    const rows = await this._db
      .select({
        counterplayId: obstacleEncounters.counterplayId,
        ratedCount: count(),
        helpedCount: sql<number>`count(*) filter (where ${obstacleEncounters.outcome} = 'helped')::int`,
      })
      .from(obstacleEncounters)
      .where(
        and(
          eq(obstacleEncounters.obstacleId, obstacleId),
          isNotNull(obstacleEncounters.counterplayId),
          isNotNull(obstacleEncounters.outcome),
        ),
      )
      .groupBy(obstacleEncounters.counterplayId);
    return rows.flatMap((row) =>
      row.counterplayId === null
        ? []
        : [
            {
              counterplayId: row.counterplayId,
              helpedCount: row.helpedCount,
              ratedCount: row.ratedCount,
            },
          ],
    );
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { goalEntries } from '../../schemas/goal-entries.schema';
import { goals } from '../../schemas/goals.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentGoalEntryRepositoryPort,
  GoalEntryCreateData,
  GoalEntryListOptions,
} from '../../../modules/accent/goals/adapters/accent-goal-entry-repository.port';
import type { GoalEntryFull } from '../../../modules/accent/goals/interfaces/goal-entry-full.interface';

/**
 * Drizzle-реализация порта записей прогресса целей (единственное место с ORM). Append-only:
 * только INSERT/SELECT, без UPDATE/DELETE (записи иммутабельны; удаление — каскадом от цели).
 * Агрегаты считаются на стороне БД (Σ / последний / первый замер) под вычисляемый
 * `currentValue` (ADR-0052). Биндится на `ACCENT_GOAL_ENTRY_REPOSITORY`.
 */
@Injectable()
export class AccentGoalEntryRepository implements AccentGoalEntryRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Добавляет запись прогресса (append-only INSERT; id — `generateId()`).
   * @param data Данные создания.
   * @returns Созданная запись.
   * @throws {Error} Если insert не вернул строку.
   */
  public async add(data: GoalEntryCreateData): Promise<GoalEntryFull> {
    const rows = await this._db
      .insert(goalEntries)
      .values({
        id: generateId(),
        goalId: data.goalId,
        value: data.value,
        occurredOn: data.occurredOn,
        note: data.note ?? null,
        sourceTaskId: data.sourceTaskId ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('goal_entries: add не вернул строку.');
    }
    return row;
  }

  /**
   * История записей цели (новые сверху по `id`), курсорная пагинация.
   * @param goalId Идентификатор цели.
   * @param options Курсор + размер страницы.
   * @returns Страница записей.
   */
  public async listByGoal(
    goalId: string,
    options: GoalEntryListOptions,
  ): Promise<GoalEntryFull[]> {
    const conds = [eq(goalEntries.goalId, goalId)];
    if (options.cursor !== undefined) {
      conds.push(lt(goalEntries.id, options.cursor));
    }
    return this._db
      .select()
      .from(goalEntries)
      .where(and(...conds))
      .orderBy(desc(goalEntries.id))
      .limit(options.limit);
  }

  /**
   * Σ значений записей цели (для накопительной цели).
   * @param goalId Идентификатор цели.
   * @returns Сумма (0, если записей нет).
   */
  public async sumValue(goalId: string): Promise<number> {
    const rows = await this._db
      .select({
        total: sql<number>`coalesce(sum(${goalEntries.value}), 0)::double precision`,
      })
      .from(goalEntries)
      .where(eq(goalEntries.goalId, goalId));
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Значение последнего замера (occurred_on desc, created_at desc).
   * @param goalId Идентификатор цели.
   * @returns Значение или null.
   */
  public async latestValue(goalId: string): Promise<number | null> {
    const rows = await this._db
      .select({ value: goalEntries.value })
      .from(goalEntries)
      .where(eq(goalEntries.goalId, goalId))
      .orderBy(desc(goalEntries.occurredOn), desc(goalEntries.createdAt))
      .limit(1);
    return rows[0]?.value ?? null;
  }

  /**
   * Значение первого замера (occurred_on asc, created_at asc) — база reach/reduce.
   * @param goalId Идентификатор цели.
   * @returns Значение или null.
   */
  public async earliestValue(goalId: string): Promise<number | null> {
    const rows = await this._db
      .select({ value: goalEntries.value })
      .from(goalEntries)
      .where(eq(goalEntries.goalId, goalId))
      .orderBy(asc(goalEntries.occurredOn), asc(goalEntries.createdAt))
      .limit(1);
    return rows[0]?.value ?? null;
  }

  /**
   * Число записей цели.
   * @param goalId Идентификатор цели.
   * @returns Количество.
   */
  public async count(goalId: string): Promise<number> {
    const rows = await this._db
      .select({ n: sql<number>`count(*)::int` })
      .from(goalEntries)
      .where(eq(goalEntries.goalId, goalId));
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * Удаляет записи цели, порождённые задачей-источником (откат при uncomplete).
   * @param goalId Идентификатор цели.
   * @param sourceTaskId Идентификатор задачи-источника.
   * @returns Число удалённых записей.
   */
  /**
   * Удаляет запись по id в пределах цели (ручная коррекция, патч 8).
   * @param id Идентификатор записи.
   * @param goalId Идентификатор цели.
   * @returns true, если удалено.
   */
  public async removeById(id: string, goalId: string): Promise<boolean> {
    const rows = await this._db
      .delete(goalEntries)
      .where(and(eq(goalEntries.id, id), eq(goalEntries.goalId, goalId)))
      .returning({ id: goalEntries.id });
    return rows.length > 0;
  }

  /**
   * Правит запись по id в пределах цели (только переданные поля; патч 8).
   * @param id Идентификатор записи.
   * @param goalId Идентификатор цели.
   * @param patch Поля (value/occurredOn/note).
   * @returns Обновлённая запись или null.
   */
  public async updateById(
    id: string,
    goalId: string,
    patch: { value?: number; occurredOn?: string; note?: string | null },
  ): Promise<GoalEntryFull | null> {
    const rows = await this._db
      .update(goalEntries)
      .set(patch)
      .where(and(eq(goalEntries.id, id), eq(goalEntries.goalId, goalId)))
      .returning();
    return rows[0] ?? null;
  }

  public async deleteBySourceTask(goalId: string, sourceTaskId: string): Promise<number> {
    const rows = await this._db
      .delete(goalEntries)
      .where(
        and(eq(goalEntries.goalId, goalId), eq(goalEntries.sourceTaskId, sourceTaskId)),
      )
      .returning({ id: goalEntries.id });
    return rows.length;
  }

  /**
   * Σ значений по всем целям аккаунта (батч, один запрос join+group by).
   * @param accountId Идентификатор аккаунта.
   * @returns Карта `goalId → сумма`.
   */
  public async sumValuesByAccount(accountId: string): Promise<Map<string, number>> {
    const rows = await this._db
      .select({
        goalId: goalEntries.goalId,
        total: sql<number>`sum(${goalEntries.value})::double precision`,
      })
      .from(goalEntries)
      .innerJoin(goals, eq(goals.id, goalEntries.goalId))
      .where(eq(goals.accountId, accountId))
      .groupBy(goalEntries.goalId);
    return new Map(rows.map((r) => [r.goalId, Number(r.total)]));
  }

  /**
   * Последний замер по каждой цели аккаунта (occurred_on desc, created_at desc) — батч.
   * @param accountId Идентификатор аккаунта.
   * @returns Карта `goalId → последнее значение`.
   */
  public async latestValuesByAccount(accountId: string): Promise<Map<string, number>> {
    const rows = await this._db
      .selectDistinctOn([goalEntries.goalId], {
        goalId: goalEntries.goalId,
        value: goalEntries.value,
      })
      .from(goalEntries)
      .innerJoin(goals, eq(goals.id, goalEntries.goalId))
      .where(eq(goals.accountId, accountId))
      .orderBy(goalEntries.goalId, desc(goalEntries.occurredOn), desc(goalEntries.createdAt));
    return new Map(rows.map((r) => [r.goalId, r.value]));
  }

  /**
   * Первый замер по каждой цели аккаунта (occurred_on asc, created_at asc) — батч.
   * @param accountId Идентификатор аккаунта.
   * @returns Карта `goalId → первое значение`.
   */
  public async earliestValuesByAccount(accountId: string): Promise<Map<string, number>> {
    const rows = await this._db
      .selectDistinctOn([goalEntries.goalId], {
        goalId: goalEntries.goalId,
        value: goalEntries.value,
      })
      .from(goalEntries)
      .innerJoin(goals, eq(goals.id, goalEntries.goalId))
      .where(eq(goals.accountId, accountId))
      .orderBy(goalEntries.goalId, asc(goalEntries.occurredOn), asc(goalEntries.createdAt));
    return new Map(rows.map((r) => [r.goalId, r.value]));
  }
}

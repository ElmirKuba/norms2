import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { goals } from '../../schemas/goals.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentGoalRepositoryPort,
  GoalCreateData,
  GoalListFilters,
  GoalUpdateData,
} from '../../../modules/accent/goals/adapters/accent-goal-repository.port';
import type { GoalFull } from '../../../modules/accent/goals/interfaces/goal-full.interface';

/**
 * Drizzle-реализация порта целей (единственное место с ORM). Строка `goals` структурно
 * совпадает с `GoalFull` (колонки 1:1, `attributes`/`pause_history` — jsonb) → маппинг
 * прямой. Всё скоупится по `account_id`. Биндится на `ACCENT_GOAL_REPOSITORY`. **Без
 * CAS/version** — агрегаты вычисляемы (ADR-0052).
 */
@Injectable()
export class AccentGoalRepository implements AccentGoalRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Цели аккаунта (created_at asc), опц. фильтр по статусу/сфере.
   * @param accountId Идентификатор аккаунта.
   * @param filters Фильтр (статус/сфера).
   * @returns Список целей владельца.
   */
  public async listByAccount(
    accountId: string,
    filters?: GoalListFilters,
  ): Promise<GoalFull[]> {
    const conds = [eq(goals.accountId, accountId)];
    if (filters?.status !== undefined) {
      conds.push(eq(goals.status, filters.status));
    }
    if (filters?.domainKey !== undefined) {
      conds.push(eq(goals.domainKey, filters.domainKey));
    }
    return this._db
      .select()
      .from(goals)
      .where(and(...conds))
      .orderBy(asc(goals.createdAt));
  }

  /**
   * Прямые подцели цели (created_at asc).
   * @param parentGoalId Идентификатор родительской цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Список подцелей.
   */
  public async listChildren(
    parentGoalId: string,
    accountId: string,
  ): Promise<GoalFull[]> {
    return this._db
      .select()
      .from(goals)
      .where(
        and(eq(goals.parentGoalId, parentGoalId), eq(goals.accountId, accountId)),
      )
      .orderBy(asc(goals.createdAt));
  }

  /**
   * Находит цель по id с проверкой владения.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  public async findOwned(id: string, accountId: string): Promise<GoalFull | null> {
    const rows = await this._db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.accountId, accountId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Создаёт цель (id — `generateId()`).
   * @param data Данные создания.
   * @returns Созданная цель.
   * @throws {Error} Если insert не вернул строку.
   */
  public async create(data: GoalCreateData): Promise<GoalFull> {
    const rows = await this._db
      .insert(goals)
      .values({
        id: generateId(),
        accountId: data.accountId,
        parentGoalId: data.parentGoalId ?? null,
        title: data.title,
        whyItMatters: data.whyItMatters ?? null,
        domainKey: data.domainKey ?? null,
        attributes: data.attributes ?? [],
        direction: data.direction,
        unit: data.unit,
        targetValue: data.targetValue,
        startValue: data.startValue ?? null,
        deadline: data.deadline ?? null,
        fallbackVersion: data.fallbackVersion ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('goals: create не вернул строку.');
    }
    return row;
  }

  /**
   * Обновляет цель владельца (только переданные поля; last-write-wins).
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  public async update(
    id: string,
    accountId: string,
    patch: GoalUpdateData,
  ): Promise<GoalFull | null> {
    const rows = await this._db
      .update(goals)
      .set(patch)
      .where(and(eq(goals.id, id), eq(goals.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
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
      .orderBy(asc(goals.position), asc(goals.createdAt));
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
        tradeoff: data.tradeoff ?? null,
        isStarter: data.isStarter ?? false,
        // Новая цель — в конец списка (ADR-0054): position = max(текущих)+1 для аккаунта.
        position: sql<number>`(select coalesce(max(${goals.position}), -1) + 1 from ${goals} where ${goals.accountId} = ${data.accountId})`,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('goals: create не вернул строку.');
    }
    return row;
  }

  /**
   * Массовая вставка целей (стартовый пак; id на каждую — `generateId()`).
   * @param items Данные создания.
   * @returns Число вставленных строк.
   */
  public async createMany(items: readonly GoalCreateData[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }
    const rows = await this._db
      .insert(goals)
      .values(
        items.map((data) => ({
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
          tradeoff: data.tradeoff ?? null,
          isStarter: data.isStarter ?? false,
        })),
      )
      .returning({ id: goals.id });
    return rows.length;
  }

  /**
   * Удаляет непринятые стартовые (`is_starter=true`) цели аккаунта; присвоенные не трогает.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  public async deleteStarters(accountId: string): Promise<number> {
    const rows = await this._db
      .delete(goals)
      .where(and(eq(goals.accountId, accountId), eq(goals.isStarter, true)))
      .returning({ id: goals.id });
    return rows.length;
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

  /**
   * Пауза (атомарно, только из `active`): `status='paused'`, `paused_at=now`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / не в `active`).
   */
  public async pause(id: string, accountId: string): Promise<GoalFull | null> {
    const rows = await this._db
      .update(goals)
      .set({ status: 'paused', pausedAt: new Date() })
      .where(
        and(
          eq(goals.id, id),
          eq(goals.accountId, accountId),
          eq(goals.status, 'active'),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Снятие паузы (атомарно, только из `paused`): `status='active'`, дописывает закрытый
   * период `{pausedAt: paused_at, resumedAt: now}` в `pause_history` (jsonb-конкатенация
   * на стороне БД → без read-modify-write), `paused_at=null`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / не в `paused`).
   */
  public async resume(id: string, accountId: string): Promise<GoalFull | null> {
    const rows = await this._db
      .update(goals)
      .set({
        status: 'active',
        pausedAt: null,
        pauseHistory: sql`${goals.pauseHistory} || jsonb_build_array(jsonb_build_object('pausedAt', ${goals.pausedAt}, 'resumedAt', now()))`,
      })
      .where(
        and(
          eq(goals.id, id),
          eq(goals.accountId, accountId),
          eq(goals.status, 'paused'),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Архивация (атомарно, из `active|paused|completed`): `status='archived'`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / уже `archived`).
   */
  public async archive(id: string, accountId: string): Promise<GoalFull | null> {
    const rows = await this._db
      .update(goals)
      .set({ status: 'archived' })
      .where(
        and(
          eq(goals.id, id),
          eq(goals.accountId, accountId),
          inArray(goals.status, ['active', 'paused', 'completed']),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Восстановление из архива (атомарно, только из `archived`): `status='active'`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / не в `archived`).
   */
  public async restore(id: string, accountId: string): Promise<GoalFull | null> {
    const rows = await this._db
      .update(goals)
      .set({ status: 'active' })
      .where(
        and(
          eq(goals.id, id),
          eq(goals.accountId, accountId),
          eq(goals.status, 'archived'),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Авто-завершение (ADR-0052): `status='completed'`, `completed_at=now` только при
   * `completed_at IS NULL` (идемпотентно, без version).
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / уже завершена).
   */
  public async markCompleted(id: string, accountId: string): Promise<GoalFull | null> {
    const rows = await this._db
      .update(goals)
      .set({ status: 'completed', completedAt: new Date() })
      .where(
        and(
          eq(goals.id, id),
          eq(goals.accountId, accountId),
          isNull(goals.completedAt),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Помечает цель «в фокусе» рангом `order` (ADR-0053): `focus_order = order`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param order Ранг внутри фокуса.
   * @returns Обновлённая строка или null.
   */
  public async setFocus(id: string, accountId: string, order: number): Promise<GoalFull | null> {
    const rows = await this._db
      .update(goals)
      .set({ focusOrder: order })
      .where(and(eq(goals.id, id), eq(goals.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Убирает цель из фокуса (ADR-0053): `focus_order = null`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null.
   */
  public async clearFocus(id: string, accountId: string): Promise<GoalFull | null> {
    const rows = await this._db
      .update(goals)
      .set({ focusOrder: null })
      .where(and(eq(goals.id, id), eq(goals.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Число фокусных целей аккаунта (`focus_order IS NOT NULL`) — для мягкого порога.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Количество.
   */
  public async countFocused(accountId: string): Promise<number> {
    const rows = await this._db
      .select({ n: sql<number>`count(*)::int` })
      .from(goals)
      .where(and(eq(goals.accountId, accountId), isNotNull(goals.focusOrder)));
    return Number(rows[0]?.n ?? 0);
  }

  /**
   * Макс. `focus_order` среди фокусных целей аккаунта (для следующего ранга) или null.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Макс. ранг или null.
   */
  public async maxFocusOrder(accountId: string): Promise<number | null> {
    const rows = await this._db
      .select({ m: sql<number | null>`max(${goals.focusOrder})` })
      .from(goals)
      .where(and(eq(goals.accountId, accountId), isNotNull(goals.focusOrder)));
    const m = rows[0]?.m;
    return m === null || m === undefined ? null : Number(m);
  }

  /**
   * Переставляет цели аккаунта в порядок `ids` (ADR-0054): `position = индекс` для своих id,
   * одним атомарным UPDATE ... FROM (VALUES …). Чужие id не затрагиваются (скоуп по account_id).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок.
   */
  public async reorder(accountId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const tuples = ids.map((id, i) => sql`(${id}, ${i})`);
    await this._db.execute(sql`
      UPDATE ${goals} AS g SET position = v.pos::int
      FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(id, pos)
      WHERE g.id = v.id AND g.account_id = ${accountId}
    `);
  }

  /**
   * Переставляет ранг фокуса (ADR-0053/0054): `focus_order = индекс` для переданных (фокусных) id.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок фокусных целей (сверху вниз).
   */
  public async reorderFocus(accountId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const tuples = ids.map((id, i) => sql`(${id}, ${i})`);
    await this._db.execute(sql`
      UPDATE ${goals} AS g SET focus_order = v.ord::int
      FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(id, ord)
      WHERE g.id = v.id AND g.account_id = ${accountId}
    `);
  }
}

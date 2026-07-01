import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { habits } from '../../schemas/habits.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentHabitRepositoryPort,
  HabitCreateData,
  HabitUpdateData,
} from '../../../modules/accent/habits/adapters/accent-habit-repository.port';
import type {
  HabitFull,
  HabitLadder,
} from '../../../modules/accent/habits/interfaces/habit-full.interface';

/**
 * Drizzle-реализация порта привычек (единственное место с ORM). Строка `habits`
 * структурно совпадает с `HabitFull` (колонки 1:1, `ladder`/`attributes` — jsonb) →
 * маппинг прямой. Всё скоупится по `account_id`. Биндится на `ACCENT_HABIT_REPOSITORY`.
 */
@Injectable()
export class AccentHabitRepository implements AccentHabitRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Активные привычки аккаунта (priority desc, затем created_at asc).
   * @param accountId Идентификатор аккаунта.
   * @returns Список привычек владельца.
   */
  public async listByAccount(accountId: string): Promise<HabitFull[]> {
    return this._db
      .select()
      .from(habits)
      .where(and(eq(habits.accountId, accountId), eq(habits.isActive, true)))
      // Тай-брейкер `id` (uuidv7 ≈ порядок вставки): drag-сортировка пишет в priority; при равных
      // priority+created_at (напр. сид: priority=0, один batch created_at) без него порядок
      // недетерминирован — привычка «прыгает» после edit (2.5.1). id делает порядок стабильным.
      .orderBy(desc(habits.priority), asc(habits.createdAt), asc(habits.id));
  }

  /**
   * Находит привычку по id с проверкой владения.
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  public async findOwned(id: string, accountId: string): Promise<HabitFull | null> {
    const rows = await this._db
      .select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.accountId, accountId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Создаёт привычку (id — `generateId()`).
   * @param data Данные создания.
   * @returns Созданная привычка.
   * @throws {Error} Если insert не вернул строку.
   */
  public async create(data: HabitCreateData): Promise<HabitFull> {
    const rows = await this._db
      .insert(habits)
      .values({
        id: generateId(),
        accountId: data.accountId,
        title: data.title,
        description: data.description ?? null,
        icon: data.icon ?? null,
        domainKey: data.domainKey ?? null,
        attributes: data.attributes ?? [],
        goalId: data.goalId ?? null,
        priority: data.priority ?? 0,
        kind: data.kind,
        recurrence: data.recurrence,
        startDate: data.startDate ?? null,
        ladder: data.ladder,
        minVersion: data.minVersion ?? null,
        isStarter: data.isStarter ?? false,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('habits: create не вернул строку.');
    }
    return row;
  }

  /**
   * Массовая вставка привычек (стартовый набор; id на каждую — `generateId()`).
   * @param items Данные создания.
   * @returns Число вставленных строк.
   */
  public async createMany(items: readonly HabitCreateData[]): Promise<number> {
    if (items.length === 0) {
      return 0;
    }
    const rows = await this._db
      .insert(habits)
      .values(
        items.map((data) => ({
          id: generateId(),
          accountId: data.accountId,
          title: data.title,
          description: data.description ?? null,
          icon: data.icon ?? null,
          domainKey: data.domainKey ?? null,
          attributes: data.attributes ?? [],
          goalId: data.goalId ?? null,
          priority: data.priority ?? 0,
          kind: data.kind,
          recurrence: data.recurrence,
          startDate: data.startDate ?? null,
          ladder: data.ladder,
          minVersion: data.minVersion ?? null,
          isStarter: data.isStarter ?? false,
        })),
      )
      .returning({ id: habits.id });
    return rows.length;
  }

  /**
   * Удаляет все непринятые стартовые (`is_starter=true`) привычки аккаунта; свои не трогает.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  public async deleteStarters(accountId: string): Promise<number> {
    const rows = await this._db
      .delete(habits)
      .where(and(eq(habits.accountId, accountId), eq(habits.isStarter, true)))
      .returning({ id: habits.id });
    return rows.length;
  }

  /**
   * Обновляет привычку владельца (только переданные поля).
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  public async update(
    id: string,
    accountId: string,
    patch: HabitUpdateData,
  ): Promise<HabitFull | null> {
    const rows = await this._db
      .update(habits)
      // Любой update bump'ает version → CAS движка лесенки замечает конкурентную правку.
      .set({ ...patch, version: sql`${habits.version} + 1` })
      .where(and(eq(habits.id, id), eq(habits.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * CAS-запись лесенки (ADR-0035): `ladder` + `version+1` только при совпадении version.
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param expectedVersion Ожидаемая версия.
   * @param ladder Новая лесенка.
   * @returns true если записано, false при конфликте версий.
   */
  public async setLadderCas(
    id: string,
    accountId: string,
    expectedVersion: number,
    ladder: HabitLadder,
  ): Promise<boolean> {
    const rows = await this._db
      .update(habits)
      .set({ ladder, version: sql`${habits.version} + 1` })
      .where(
        and(
          eq(habits.id, id),
          eq(habits.accountId, accountId),
          eq(habits.version, expectedVersion),
        ),
      )
      .returning({ id: habits.id });
    return rows.length > 0;
  }

  /**
   * Ручная сортировка перетаскиванием (ADR-0054): пишем в существующий `priority` (список уже
   * сортируется `desc(priority)`), без отдельной колонки. Верхний элемент → наибольший priority.
   * Атомарным UPDATE FROM (VALUES …); чужие id игнорируются (скоуп по account_id).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок (сверху вниз).
   */
  public async reorder(accountId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const n = ids.length;
    const tuples = ids.map((id, i) => sql`(${id}, ${n - i})`);
    await this._db.execute(sql`
      UPDATE ${habits} AS h SET priority = v.pri::int
      FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(id, pri)
      WHERE h.id = v.id AND h.account_id = ${accountId}
    `);
  }
}

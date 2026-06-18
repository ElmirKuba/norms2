import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { habits } from '../../schemas/habits.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentHabitRepositoryPort,
  HabitCreateData,
  HabitUpdateData,
} from '../../../modules/accent/habits/adapters/accent-habit-repository.port';
import type { HabitFull } from '../../../modules/accent/habits/interfaces/habit-full.interface';

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
      .orderBy(desc(habits.priority), asc(habits.createdAt));
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
        ladder: data.ladder,
        minVersion: data.minVersion ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('habits: create не вернул строку.');
    }
    return row;
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
      .set(patch)
      .where(and(eq(habits.id, id), eq(habits.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }
}

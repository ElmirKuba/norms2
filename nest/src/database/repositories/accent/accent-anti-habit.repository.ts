import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { antiHabits } from '../../schemas/anti-habits.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentAntiHabitRepositoryPort,
  AntiHabitAttemptCas,
  AntiHabitCreateData,
  AntiHabitUpdateData,
} from '../../../modules/accent/anti-habits/adapters/accent-anti-habit-repository.port';
import type { AntiHabitFull } from '../../../modules/accent/anti-habits/interfaces/anti-habit-full.interface';

/**
 * Drizzle-реализация порта анти-привычек (единственное место с ORM). Строка `anti_habits`
 * структурно совпадает с `AntiHabitFull` (колонки 1:1) → маппинг прямой. Всё скоупится по
 * `account_id`. Биндится на `ACCENT_ANTI_HABIT_REPOSITORY`.
 */
@Injectable()
export class AccentAntiHabitRepository implements AccentAntiHabitRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Активные анти-привычки аккаунта (created_at asc, тай-брейкер id — стабильный порядок).
   * @param accountId Идентификатор аккаунта.
   * @returns Список анти-привычек владельца.
   */
  public async listByAccount(accountId: string): Promise<AntiHabitFull[]> {
    return this._db
      .select()
      .from(antiHabits)
      .where(and(eq(antiHabits.accountId, accountId), eq(antiHabits.isActive, true)))
      // Ручной порядок (ADR-0054), затем created_at, тай-брейкер id (детерминизм при равных position).
      .orderBy(asc(antiHabits.position), asc(antiHabits.createdAt), asc(antiHabits.id));
  }

  /**
   * Находит анти-привычку по id с проверкой владения.
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  public async findOwned(id: string, accountId: string): Promise<AntiHabitFull | null> {
    const rows = await this._db
      .select()
      .from(antiHabits)
      .where(and(eq(antiHabits.id, id), eq(antiHabits.accountId, accountId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Создаёт анти-привычку (id — `generateId()`; attemptNumber=1, recordDays=0).
   * @param data Данные создания.
   * @returns Созданная анти-привычка.
   * @throws {Error} Если insert не вернул строку.
   */
  public async create(data: AntiHabitCreateData): Promise<AntiHabitFull> {
    const rows = await this._db
      .insert(antiHabits)
      .values({
        id: generateId(),
        accountId: data.accountId,
        title: data.title,
        description: data.description ?? null,
        isActive: true,
        currentAttemptStartedAt: data.currentAttemptStartedAt,
        attemptNumber: 1,
        recordDays: 0,
        recordAttemptStartedAt: null,
        targetDays: data.targetDays ?? null,
        // Новая анти-привычка — в конец списка (ADR-0054): position = max+1 для аккаунта.
        position: sql<number>`(select coalesce(max(${antiHabits.position}), -1) + 1 from ${antiHabits} where ${antiHabits.accountId} = ${data.accountId})`,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('anti_habits: create не вернул строку.');
    }
    return row;
  }

  /**
   * Переставляет анти-привычки аккаунта в порядок `ids` (ADR-0054): `position = индекс` для своих
   * id атомарным UPDATE FROM (VALUES …); чужие id игнорируются (скоуп по account_id).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок (сверху вниз).
   */
  public async reorder(accountId: string, ids: readonly string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const tuples = ids.map((id, i) => sql`(${id}, ${i})`);
    await this._db.execute(sql`
      UPDATE ${antiHabits} AS a SET position = v.pos::int
      FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(id, pos)
      WHERE a.id = v.id AND a.account_id = ${accountId}
    `);
  }

  /**
   * Обновляет анти-привычку владельца (только переданные поля; version+1).
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  public async update(
    id: string,
    accountId: string,
    patch: AntiHabitUpdateData,
  ): Promise<AntiHabitFull | null> {
    const rows = await this._db
      .update(antiHabits)
      .set({ ...patch, version: sql`${antiHabits.version} + 1` })
      .where(and(eq(antiHabits.id, id), eq(antiHabits.accountId, accountId)))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * CAS-рестарт попытки при рецидиве (ADR-0035): пишет поля попытки/рекорда и `version+1`
   * только при совпадении version. Гонка двух срывов: применится одна, вторая получит false.
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param expectedVersion Ожидаемая версия.
   * @param patch Новые значения попытки/рекорда.
   * @returns true если записано, false при конфликте версий.
   */
  public async setAttemptCas(
    id: string,
    accountId: string,
    expectedVersion: number,
    patch: AntiHabitAttemptCas,
  ): Promise<boolean> {
    const rows = await this._db
      .update(antiHabits)
      .set({
        currentAttemptStartedAt: patch.currentAttemptStartedAt,
        attemptNumber: patch.attemptNumber,
        recordDays: patch.recordDays,
        recordAttemptStartedAt: patch.recordAttemptStartedAt,
        version: sql`${antiHabits.version} + 1`,
      })
      .where(
        and(
          eq(antiHabits.id, id),
          eq(antiHabits.accountId, accountId),
          eq(antiHabits.version, expectedVersion),
        ),
      )
      .returning({ id: antiHabits.id });
    return rows.length > 0;
  }
}

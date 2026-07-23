import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { antiHabitRelapses } from '../../schemas/anti-habit-relapses.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentAntiHabitRelapseRepositoryPort,
  AntiHabitRelapseCreateData,
  AntiHabitRelapseListOptions,
} from '../../../modules/accent/anti-habits/adapters/accent-anti-habit-relapse-repository.port';
import type { AntiHabitRelapseFull } from '../../../modules/accent/anti-habits/interfaces/anti-habit-relapse-full.interface';

/**
 * Drizzle-реализация порта рецидивов (единственное место с ORM). Строка
 * `anti_habit_relapses` совпадает с `AntiHabitRelapseFull` (колонки 1:1). Append-only:
 * только insert + keyset-листинг. Биндится на `ACCENT_ANTI_HABIT_RELAPSE_REPOSITORY`.
 */
@Injectable()
export class AccentAntiHabitRelapseRepository implements AccentAntiHabitRelapseRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Добавляет рецидив (id — `generateId()`).
   * @param data Данные рецидива.
   * @returns Созданная запись.
   * @throws {Error} Если insert не вернул строку.
   */
  public async insert(data: AntiHabitRelapseCreateData): Promise<AntiHabitRelapseFull> {
    const rows = await this._db
      .insert(antiHabitRelapses)
      .values({
        id: generateId(),
        antiHabitId: data.antiHabitId,
        relapseAt: data.relapseAt,
        attemptDurationMs: data.attemptDurationMs,
        triggerTag: data.triggerTag ?? null,
        note: data.note ?? null,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('anti_habit_relapses: insert не вернул строку.');
    }
    return row;
  }

  /**
   * История рецидивов (новые→старые), keyset-пагинация по (relapse_at desc, id desc).
   * Курсор `(relapseAt, id)` → строки строго «раньше» курсора в порядке сортировки.
   * @param antiHabitId Идентификатор анти-привычки.
   * @param opts limit + опц. курсор.
   * @returns Страница рецидивов (не более `limit`).
   */
  public async listRelapses(
    antiHabitId: string,
    opts: AntiHabitRelapseListOptions,
  ): Promise<AntiHabitRelapseFull[]> {
    const cursor = opts.cursor;
    const where = cursor
      ? and(
          eq(antiHabitRelapses.antiHabitId, antiHabitId),
          or(
            lt(antiHabitRelapses.relapseAt, cursor.relapseAt),
            and(
              eq(antiHabitRelapses.relapseAt, cursor.relapseAt),
              lt(antiHabitRelapses.id, cursor.id),
            ),
          ),
        )
      : eq(antiHabitRelapses.antiHabitId, antiHabitId);
    return this._db
      .select()
      .from(antiHabitRelapses)
      .where(where)
      .orderBy(desc(antiHabitRelapses.relapseAt), desc(antiHabitRelapses.id))
      .limit(opts.limit);
  }
}

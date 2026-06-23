import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { milestones } from '../../schemas/milestones.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type {
  AccentMilestoneRepositoryPort,
  MilestoneCreateData,
} from '../../../modules/accent/goals/adapters/accent-milestone-repository.port';
import type { MilestoneFull } from '../../../modules/accent/goals/interfaces/milestone-full.interface';

/**
 * Drizzle-реализация порта вех (единственное место с ORM). Строка `milestones` структурно
 * совпадает с `MilestoneFull` → маппинг прямой. Достигнутость не хранится (вычисляется в
 * домене, ADR-0052). Биндится на `ACCENT_MILESTONE_REPOSITORY`.
 */
@Injectable()
export class AccentMilestoneRepository implements AccentMilestoneRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Создаёт веху (id — `generateId()`).
   * @param data Данные создания.
   * @returns Созданная веха.
   * @throws {Error} Если insert не вернул строку.
   */
  public async add(data: MilestoneCreateData): Promise<MilestoneFull> {
    const rows = await this._db
      .insert(milestones)
      .values({
        id: generateId(),
        goalId: data.goalId,
        title: data.title,
        thresholdValue: data.thresholdValue,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('milestones: add не вернул строку.');
    }
    return row;
  }

  /**
   * Вехи цели по возрастанию порога.
   * @param goalId Идентификатор цели.
   * @returns Список вех.
   */
  public async listByGoal(goalId: string): Promise<MilestoneFull[]> {
    return this._db
      .select()
      .from(milestones)
      .where(eq(milestones.goalId, goalId))
      .orderBy(asc(milestones.thresholdValue));
  }

  /**
   * Находит веху по id в пределах цели.
   * @param id Идентификатор вехи.
   * @param goalId Идентификатор цели.
   * @returns Веха или null.
   */
  public async findInGoal(id: string, goalId: string): Promise<MilestoneFull | null> {
    const rows = await this._db
      .select()
      .from(milestones)
      .where(and(eq(milestones.id, id), eq(milestones.goalId, goalId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Удаляет веху цели.
   * @param id Идентификатор вехи.
   * @param goalId Идентификатор цели.
   * @returns true, если строка удалена.
   */
  public async remove(id: string, goalId: string): Promise<boolean> {
    const rows = await this._db
      .delete(milestones)
      .where(and(eq(milestones.id, id), eq(milestones.goalId, goalId)))
      .returning({ id: milestones.id });
    return rows.length > 0;
  }
}

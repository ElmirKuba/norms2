import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { userAchievements } from '../../schemas/user-achievements.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { AccentUserAchievementRepositoryPort } from '../../../modules/accent/progress/adapters/accent-user-achievement-repository.port';
import type {
  AchievementCode,
  UserAchievementFull,
} from '../../../modules/accent/progress/interfaces/user-achievement-full.interface';

/**
 * Drizzle-реализация порта достижений (единственное место с ORM). Строка `user_achievements`
 * структурно совпадает с `UserAchievementFull` → маппинг прямой. Биндится на
 * `ACCENT_USER_ACHIEVEMENT_REPOSITORY`.
 */
@Injectable()
export class AccentUserAchievementRepository implements AccentUserAchievementRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Выдаёт достижение идемпотентно через `ON CONFLICT DO NOTHING` на уникальном
   * `(account_id, code)`: повторная выдача — не ошибка, а «уже было», и `returning()` в этом
   * случае отдаёт пустой массив. Проверять `SELECT`-ом перед вставкой нельзя — между проверкой
   * и записью помещается второй запрос.
   * @param accountId Владелец.
   * @param code Код достижения.
   * @param context Деталь момента (опц.).
   * @returns Созданная запись или `null`, если достижение уже было.
   */
  public async award(
    accountId: string,
    code: AchievementCode,
    context?: string | null,
  ): Promise<UserAchievementFull | null> {
    const rows = await this._db
      .insert(userAchievements)
      .values({ id: generateId(), accountId, code, context: context ?? null })
      .onConflictDoNothing({
        target: [userAchievements.accountId, userAchievements.code],
      })
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Все выданные достижения аккаунта (новые→старые).
   * @param accountId Владелец.
   * @returns Записи.
   */
  public listByAccount(accountId: string): Promise<UserAchievementFull[]> {
    return this._db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.accountId, accountId))
      .orderBy(desc(userAchievements.awardedAt), desc(userAchievements.id));
  }

  /**
   * Коды уже выданных достижений — читает одну колонку, чтобы правила выдачи могли дёшево
   * отсеять то, что считать незачем.
   * @param accountId Владелец.
   * @returns Множество кодов.
   */
  public async awardedCodes(accountId: string): Promise<Set<AchievementCode>> {
    const rows = await this._db
      .select({ code: userAchievements.code })
      .from(userAchievements)
      .where(eq(userAchievements.accountId, accountId));
    return new Set(rows.map((row) => row.code));
  }
}

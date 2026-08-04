import type {
  AchievementCode,
  UserAchievementFull,
} from '../interfaces/user-achievement-full.interface';

/** DI-токен порта репозитория достижений (биндится в progress.module). */
export const ACCENT_USER_ACHIEVEMENT_REPOSITORY = Symbol('ACCENT_USER_ACHIEVEMENT_REPOSITORY');

/**
 * Порт репозитория выданных достижений, БЕЗ ORM. Скоуп — по `accountId`.
 * Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentUserAchievementRepositoryPort {
  /**
   * Выдаёт достижение **идемпотентно**: если у аккаунта такой код уже есть, ничего не пишет и
   * возвращает `null`. Правило «один раз за всё время» держит уникальный индекс в БД, а не
   * проверка перед вставкой, — иначе два параллельных запроса выдали бы дубль.
   * @param accountId Владелец.
   * @param code Код достижения.
   * @param context Человекочитаемая деталь момента (опц.).
   * @returns Созданная запись или `null`, если достижение уже было выдано раньше.
   */
  award(
    accountId: string,
    code: AchievementCode,
    context?: string | null,
  ): Promise<UserAchievementFull | null>;

  /**
   * Все выданные достижения аккаунта (новые→старые).
   * @param accountId Владелец.
   * @returns Записи.
   */
  listByAccount(accountId: string): Promise<UserAchievementFull[]>;

  /**
   * Коды уже выданных достижений — дешёвая проверка перед вычислением правил выдачи.
   * @param accountId Владелец.
   * @returns Множество кодов.
   */
  awardedCodes(accountId: string): Promise<Set<AchievementCode>>;
}

import type { MilestoneFull } from '../interfaces/milestone-full.interface';

/** DI-токен порта репозитория вех (биндится в goals.module). */
export const ACCENT_MILESTONE_REPOSITORY = Symbol('ACCENT_MILESTONE_REPOSITORY');

/** Данные создания вехи (id/таймстамп проставляет репозиторий). */
export interface MilestoneCreateData {
  /** Родительская цель — FK на `goals.id`. */
  goalId: string;
  /** Название. */
  title: string;
  /** Порог достижения. */
  thresholdValue: number;
}

/**
 * Порт репозитория вех целей, БЕЗ ORM. Владение проверяется выше (по родительской цели),
 * поэтому методы принимают `goalId` уже проверенной цели. Достигнутость не хранится —
 * вычисляется в домене (ADR-0052). Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentMilestoneRepositoryPort {
  /**
   * Создаёт веху (id генерирует репозиторий).
   * @param data Данные создания.
   * @returns Созданная веха.
   */
  add(data: MilestoneCreateData): Promise<MilestoneFull>;

  /**
   * Вехи цели по возрастанию порога.
   * @param goalId Идентификатор цели.
   * @returns Список вех.
   */
  listByGoal(goalId: string): Promise<MilestoneFull[]>;

  /**
   * Находит веху по id в пределах цели (для проверки перед удалением).
   * @param id Идентификатор вехи.
   * @param goalId Идентификатор цели.
   * @returns Веха или null.
   */
  findInGoal(id: string, goalId: string): Promise<MilestoneFull | null>;

  /**
   * Удаляет веху цели.
   * @param id Идентификатор вехи.
   * @param goalId Идентификатор цели.
   * @returns true, если строка удалена.
   */
  remove(id: string, goalId: string): Promise<boolean>;
}

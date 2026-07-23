import type { AntiHabitRelapseFull } from '../interfaces/anti-habit-relapse-full.interface';

/** DI-токен порта репозитория рецидивов (биндится в anti-habits.module). */
export const ACCENT_ANTI_HABIT_RELAPSE_REPOSITORY = Symbol('ACCENT_ANTI_HABIT_RELAPSE_REPOSITORY');

/** Данные добавления рецидива (id/created_at проставляет репозиторий). */
export interface AntiHabitRelapseCreateData {
  /** Родительская анти-привычка — FK. */
  antiHabitId: string;
  /** Момент срыва (unix ms). */
  relapseAt: number;
  /** Длительность завершившейся попытки (мс). */
  attemptDurationMs: number;
  /** Триггер (опц.). */
  triggerTag?: string | null;
  /** Заметка (опц.). */
  note?: string | null;
}

/** Keyset-курсор истории рецидивов: пара (relapseAt, id), сортировка desc/desc. */
export interface RelapseCursor {
  /** relapseAt последнего отданного элемента. */
  relapseAt: number;
  /** id последнего отданного элемента (тай-брейкер при равном relapseAt). */
  id: string;
}

/** Опции листинга истории рецидивов. */
export interface AntiHabitRelapseListOptions {
  /** Сколько строк вернуть (страница). */
  limit: number;
  /** Курсор предыдущей страницы или null/undefined для первой. */
  cursor?: RelapseCursor | null;
}

/**
 * Порт репозитория рецидивов (append-only), БЕЗ ORM. Владение проверяется через
 * родительскую анти-привычку (домен). Реализация — `database/repositories/accent`.
 */
export interface AccentAntiHabitRelapseRepositoryPort {
  /**
   * Добавляет рецидив (id генерирует репозиторий).
   * @param data Данные рецидива.
   * @returns Созданная запись.
   */
  insert(data: AntiHabitRelapseCreateData): Promise<AntiHabitRelapseFull>;

  /**
   * История рецидивов анти-привычки (новые→старые), keyset-пагинация по (relapseAt, id).
   * @param antiHabitId Идентификатор анти-привычки.
   * @param opts limit + опц. курсор.
   * @returns Страница рецидивов (не более `limit`).
   */
  listRelapses(
    antiHabitId: string,
    opts: AntiHabitRelapseListOptions,
  ): Promise<AntiHabitRelapseFull[]>;
}

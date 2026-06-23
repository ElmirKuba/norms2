import type { GoalEntryFull } from '../interfaces/goal-entry-full.interface';

/** DI-токен порта репозитория записей прогресса целей (биндится в goals.module). */
export const ACCENT_GOAL_ENTRY_REPOSITORY = Symbol('ACCENT_GOAL_ENTRY_REPOSITORY');

/** Данные создания записи прогресса (id/таймстамп проставляет репозиторий). */
export interface GoalEntryCreateData {
  /** Родительская цель — FK на `goals.id`. */
  goalId: string;
  /** Значение (инкремент для accumulate / замер для reach/reduce). */
  value: number;
  /** Дата записи YYYY-MM-DD. */
  occurredOn: string;
  /** Заметка (опц.). */
  note?: string | null;
  /** Источник-задача (привычка→цель) — для отката при uncomplete (опц.). */
  sourceTaskId?: string | null;
}

/** Опции курсорной выборки истории (по убыванию `id` = новые сверху). */
export interface GoalEntryListOptions {
  /** Курсор — `id` последней полученной записи (вернёт строго старше неё). */
  cursor?: string | undefined;
  /** Размер страницы. */
  limit: number;
}

/**
 * Порт репозитория записей прогресса целей (append-only), БЕЗ ORM. Владение проверяется
 * выше (по родительской цели), поэтому методы принимают `goalId` уже проверенной цели.
 * Агрегаты (`sumValue`/`latestValue`/`earliestValue`) — для **вычисляемого `currentValue`**
 * (ADR-0052): accumulate → Σ; reach/reduce → последний замер (база — первый, если
 * `startValue` не задан). Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentGoalEntryRepositoryPort {
  /**
   * Добавляет запись прогресса (append-only INSERT; id генерирует репозиторий).
   * @param data Данные создания.
   * @returns Созданная запись.
   */
  add(data: GoalEntryCreateData): Promise<GoalEntryFull>;

  /**
   * История записей цели (новые сверху), курсорная пагинация по `id`.
   * @param goalId Идентификатор цели.
   * @param options Курсор + размер страницы.
   * @returns Страница записей.
   */
  listByGoal(goalId: string, options: GoalEntryListOptions): Promise<GoalEntryFull[]>;

  /**
   * Σ значений всех записей цели (для `currentValue` накопительной цели).
   * @param goalId Идентификатор цели.
   * @returns Сумма (0, если записей нет).
   */
  sumValue(goalId: string): Promise<number>;

  /**
   * Значение последнего замера (по `occurred_on`, затем `created_at`) — для `currentValue`
   * целей reach/reduce.
   * @param goalId Идентификатор цели.
   * @returns Значение или null (записей нет).
   */
  latestValue(goalId: string): Promise<number | null>;

  /**
   * Значение первого замера (по `occurred_on`, затем `created_at`) — база reach/reduce,
   * если `startValue` не задан (ADR-0052).
   * @param goalId Идентификатор цели.
   * @returns Значение или null (записей нет).
   */
  earliestValue(goalId: string): Promise<number | null>;

  /**
   * Число записей цели (есть ли вообще прогресс).
   * @param goalId Идентификатор цели.
   * @returns Количество записей.
   */
  count(goalId: string): Promise<number>;

  /**
   * Удаляет записи цели, порождённые задачей-источником (откат прогресса при uncomplete,
   * 2.5·23 P2). Идемпотентно: нет таких записей → 0.
   * @param goalId Идентификатор цели.
   * @param sourceTaskId Идентификатор задачи-источника.
   * @returns Число удалённых записей.
   */
  deleteBySourceTask(goalId: string, sourceTaskId: string): Promise<number>;

  /**
   * **Батч (2.5·23 P2#3):** Σ значений по всем целям аккаунта одним запросом — для списка
   * целей без N+1. Цели без записей в карте отсутствуют (трактуй как 0).
   * @param accountId Идентификатор аккаунта.
   * @returns Карта `goalId → сумма`.
   */
  sumValuesByAccount(accountId: string): Promise<Map<string, number>>;

  /**
   * **Батч:** последний замер по каждой цели аккаунта (reach/reduce) одним запросом.
   * @param accountId Идентификатор аккаунта.
   * @returns Карта `goalId → последнее значение`.
   */
  latestValuesByAccount(accountId: string): Promise<Map<string, number>>;

  /**
   * **Батч:** первый замер по каждой цели аккаунта (база reach/reduce) одним запросом.
   * @param accountId Идентификатор аккаунта.
   * @returns Карта `goalId → первое значение`.
   */
  earliestValuesByAccount(accountId: string): Promise<Map<string, number>>;
}

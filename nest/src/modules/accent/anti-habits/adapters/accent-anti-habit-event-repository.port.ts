import type {
  AntiHabitEventFull,
  AntiHabitEventType,
} from '../interfaces/anti-habit-event-full.interface';

/** DI-токен порта репозитория событий «держусь» (биндится в anti-habits.module). */
export const ACCENT_ANTI_HABIT_EVENT_REPOSITORY = Symbol('ACCENT_ANTI_HABIT_EVENT_REPOSITORY');

/** Данные добавления события (id/created_at проставляет репозиторий; поля не для типа = null). */
export interface AntiHabitEventCreateData {
  /** Родительская анти-привычка — FK. */
  antiHabitId: string;
  /** Тип события. */
  type: AntiHabitEventType;
  /** Когда произошло (unix ms). */
  occurredAt: number;
  /** relapse/reschedule: длительность завершившейся попытки (мс). */
  attemptDurationMs?: number | null;
  /** relapse: номер завершившейся попытки. */
  endedAttemptNumber?: number | null;
  /** relapse: триггер. */
  triggerTag?: string | null;
  /** relapse: заметка. */
  note?: string | null;
  /** reschedule: прежний старт (unix ms). */
  fromStartedAt?: number | null;
  /** reschedule/plan: новый (будущий) старт (unix ms). */
  toStartedAt?: number | null;
  /** reschedule: сколько продержался (дней). */
  heldDays?: number | null;
  /** goal_reached: ярлык порога. */
  thresholdLabel?: string | null;
  /** goal_reached: номинал порога (дней). */
  thresholdDays?: number | null;
}

/** Keyset-курсор истории событий: пара (occurredAt, id), сортировка desc/desc. */
export interface AntiHabitEventCursor {
  /** occurredAt последнего отданного элемента. */
  occurredAt: number;
  /** id последнего отданного элемента (тай-брейкер). */
  id: string;
}

/** Опции листинга истории событий. */
export interface AntiHabitEventListOptions {
  /** Сколько строк вернуть (страница). */
  limit: number;
  /** Курсор предыдущей страницы или null/undefined для первой. */
  cursor?: AntiHabitEventCursor | null;
}

/**
 * Порт репозитория событий «держусь» (append-only, ADR-0059), БЕЗ ORM. Владение проверяется
 * через родительскую анти-привычку (домен). Реализация — `database/repositories/accent`.
 */
export interface AccentAntiHabitEventRepositoryPort {
  /**
   * Добавляет событие (id генерирует репозиторий).
   * @param data Данные события.
   * @returns Созданная запись.
   */
  insert(data: AntiHabitEventCreateData): Promise<AntiHabitEventFull>;

  /**
   * История событий анти-привычки (новые→старые), keyset-пагинация по (occurredAt, id).
   * @param antiHabitId Идентификатор анти-привычки.
   * @param opts limit + опц. курсор.
   * @returns Страница событий (не более `limit`).
   */
  listEvents(
    antiHabitId: string,
    opts: AntiHabitEventListOptions,
  ): Promise<AntiHabitEventFull[]>;

  /**
   * Максимальный `thresholdDays` среди событий `goal_reached` с `occurredAt >= sinceOccurredAt`
   * (ADR-0060). `sinceOccurredAt` = старт текущей попытки → учитываются только пороги ЭТОЙ серии
   * (события прошлых попыток произошли раньше старта). Нужен для идемпотентной материализации
   * авто-цели: `reachedGoals(...)` возвращает только ступени с `thresholdDays > since`.
   * @param antiHabitId Идентификатор анти-привычки.
   * @param sinceOccurredAt Нижняя граница `occurredAt` (unix ms; обычно старт текущей попытки).
   * @returns Наибольший уже отмеченный порог (дней) или 0, если отметок нет.
   */
  latestGoalReachedThreshold(antiHabitId: string, sinceOccurredAt: number): Promise<number>;
}

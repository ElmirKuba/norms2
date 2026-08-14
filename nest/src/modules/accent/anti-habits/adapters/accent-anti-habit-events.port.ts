/** DI-токен исходящего порта событий анти-привычек (биндится в anti-habits.module). */
export const ACCENT_ANTI_HABIT_EVENTS = Symbol('ACCENT_ANTI_HABIT_EVENTS');

/** Событие срыва — эмитится при `relapse` (хук для геймификации 2.9). */
export interface AntiHabitRelapsedEvent {
  /** Анти-привычка. */
  antiHabitId: string;
  /** Владелец. */
  accountId: string;
  /** Момент срыва (unix ms). */
  relapseAt: number;
  /** Сколько продержалась завершившаяся попытка (мс). */
  endedAttemptDurationMs: number;
  /** Номер завершившейся попытки. */
  endedAttemptNumber: number;
}

/** Событие «держится/веха серии» — хук для 2.9 (веха 3/7/14/30… при дневном чек-ине). */
export interface AntiHabitHeldEvent {
  /** Анти-привычка. */
  antiHabitId: string;
  /** Владелец. */
  accountId: string;
  /** Достигнутая веха серии (дней). */
  days: number;
}

/**
 * Исходящий порт доменных событий анти-привычек (domain-model §7, gamification §7). 2.6
 * лишь **эмитит хуки** — слушателей/начисления очков НЕТ до 2.9. Чистая граница: домен
 * зависит от порта, а не от конкретной шины; 2.9 подменит реализацию (реальная
 * event-шина/начисление) без правки домена.
 */
export interface AccentAntiHabitEventsPort {
  /**
   * Срыв анти-привычки.
   * @param event Данные срыва.
   */
  relapsed(event: AntiHabitRelapsedEvent): void;

  /**
   * Достигнута веха серии.
   *
   * TODO: Claude Code: 2026-08-14: хук не эмитит НИКТО — сверка вызовов 14.08.2026. Писался под
   * «2.9-механику дневного чек-ина», но 2.9 закрыта, а чек-ина в ней не появилось. Решить в
   * недельном слое (2.10): либо начать эмитить на дневной отметке «держусь», либо удалить —
   * объявленный и молчащий хук хуже отсутствующего, потому что читается как работающий.
   * @param event Данные вехи.
   */
  held(event: AntiHabitHeldEvent): void;
}

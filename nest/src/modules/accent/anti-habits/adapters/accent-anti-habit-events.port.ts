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
   * Достигнута веха серии (эмитит 2.9-механика дневного чек-ина; в 2.6 не вызывается).
   * @param event Данные вехи.
   */
  held(event: AntiHabitHeldEvent): void;
}

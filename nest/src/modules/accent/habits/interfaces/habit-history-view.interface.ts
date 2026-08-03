/** Что случилось с привычкой в этот день (2.7.3). */
export const HABIT_HISTORY_EVENTS = ['done', 'partial', 'postponed', 'pending'] as const;

/** Событие дня в истории привычки. */
export type HabitHistoryEvent = (typeof HABIT_HISTORY_EVENTS)[number];

/** Движение адаптивной планки, восстановленное по снимкам `targetValue` соседних дней. */
export interface HabitLadderMove {
  /** Планка до этого дня. */
  from: number;
  /** Планка в этот день. */
  to: number;
}

/**
 * Один день истории привычки. **Обработанный факт, а не сырая строка:** перенос склеен в одно
 * событие с датой назначения, движение планки посчитано, лишнего не отдаём.
 */
export interface HabitHistoryDay {
  /** Локальная дата дня `YYYY-MM-DD`. */
  occurredOn: string;
  /** Что случилось. */
  event: HabitHistoryEvent;
  /** Сколько сделано или null. */
  doneValue: number | null;
  /** Какая была планка в этот день (снимок) или null. */
  targetValue: number | null;
  /** Момент выполнения (ISO) или null. */
  completedAt: string | null;
  /** Куда перенесли (`YYYY-MM-DD`) — только у `postponed`; иначе null. */
  postponedTo: string | null;
  /** Это сегодняшний день — значит кнопка «В „Сегодня“» имеет смысл. */
  isToday: boolean;
  /** Движение планки в этот день или null. */
  ladderMove: HabitLadderMove | null;
}

/**
 * Ответ истории привычки (2.7.3). Кроме страницы дней несёт «тишину»: когда была последняя
 * отметка и сколько с тех пор прошло. Тон наружу — «последняя отметка N дней назад», а не
 * «пропущено N дней»: первое сообщает факт, второе ставит оценку.
 */
export interface HabitHistoryView {
  /** Страница дней, от свежих к старым. */
  items: HabitHistoryDay[];
  /** Курсор для «Показать ещё» (`occurredOn` последнего дня страницы) или null — больше нет. */
  nextCursor: string | null;
  /** Последний день с реальной отметкой (`YYYY-MM-DD`) или null — отметок не было ни разу. */
  lastMarkedOn: string | null;
  /** Сколько дней прошло с последней отметки или null. */
  daysSinceLastMark: number | null;
  /**
   * Сколько дней по расписанию прошло без отметки — **оценка, а не факт**: расписание могли
   * менять задним числом, а материализация ленивая, поэтому строк за те дни может не быть вовсе.
   * Считается на лету, в БД ничего не пишется.
   */
  missedEstimate: number;
}

import type {
  AntiHabitEventFull,
  AntiHabitEventType,
} from './anti-habit-event-full.interface';

/**
 * AntiHabitEventView — событие таймлайна наружу (без `antiHabitId` — он в URL; ADR-0059).
 * `type` + типо-специфичные поля (null для незадействованных). Времена — unix ms.
 */
export interface AntiHabitEventView {
  /** Идентификатор. */
  id: string;
  /** Тип события. */
  type: AntiHabitEventType;
  /** Когда произошло (unix ms). */
  occurredAt: number;
  /** relapse/reschedule: длительность завершившейся попытки (мс) или null. */
  attemptDurationMs: number | null;
  /** relapse: номер завершившейся попытки или null. */
  endedAttemptNumber: number | null;
  /** relapse: триггер или null. */
  triggerTag: string | null;
  /** relapse: заметка или null. */
  note: string | null;
  /** reschedule: прежний старт (unix ms) или null. */
  fromStartedAt: number | null;
  /** reschedule/plan: новый (будущий) старт (unix ms) или null. */
  toStartedAt: number | null;
  /** reschedule: сколько продержался (дней) или null. */
  heldDays: number | null;
  /** goal_reached: ярлык порога или null. */
  thresholdLabel: string | null;
  /** goal_reached: номинал порога (дней) или null. */
  thresholdDays: number | null;
}

/** Страница истории событий (cursor-пагинация). */
export interface AntiHabitEventPage {
  /** События (новые→старые). */
  items: AntiHabitEventView[];
  /** Курсор следующей страницы или null. */
  nextCursor: string | null;
}

/**
 * Проецирует доменное событие наружу (скрывает antiHabitId/created_at).
 * @param full Доменная запись.
 * @returns Проекция наружу.
 */
export function toAntiHabitEventView(full: AntiHabitEventFull): AntiHabitEventView {
  return {
    id: full.id,
    type: full.type,
    occurredAt: full.occurredAt,
    attemptDurationMs: full.attemptDurationMs,
    endedAttemptNumber: full.endedAttemptNumber,
    triggerTag: full.triggerTag,
    note: full.note,
    fromStartedAt: full.fromStartedAt,
    toStartedAt: full.toStartedAt,
    heldDays: full.heldDays,
    thresholdLabel: full.thresholdLabel,
    thresholdDays: full.thresholdDays,
  };
}

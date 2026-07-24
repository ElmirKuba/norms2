/**
 * Типы событий таймлайна «держусь» (ADR-0059). Единая лента вместо relapse-only:
 * `relapse` (срыв), `reschedule` (перенос идущей серии в будущее), `plan` (плановый старт при
 * создании), `goal_reached` (достигнут порог авто-цели, ADR-0060).
 */
export const ANTI_HABIT_EVENT_TYPES = ['relapse', 'reschedule', 'plan', 'goal_reached'] as const;

/** Тип события (производно от `ANTI_HABIT_EVENT_TYPES`). */
export type AntiHabitEventType = (typeof ANTI_HABIT_EVENT_TYPES)[number];

/**
 * AntiHabitEventFull — событие таймлайна «держусь» (append-only; колонки 1:1 со схемой
 * `anti_habit_events`, ADR-0033/0059). Общие поля + типо-специфичные nullable (явные колонки,
 * без jsonb-свалки — «без скрытой магии»). Незадействованные для типа поля = null.
 */
export interface AntiHabitEventFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Родительская анти-привычка — FK на `anti_habits.id` (ON DELETE CASCADE). */
  antiHabitId: string;
  /** Тип события. */
  type: AntiHabitEventType;
  /** Когда произошло — unix ms. */
  occurredAt: number;

  // ── relapse ──
  /** Длительность завершившейся попытки (мс) — для `relapse`/`reschedule`. */
  attemptDurationMs: number | null;
  /** Номер завершившейся попытки — для `relapse`. */
  endedAttemptNumber: number | null;
  /** Триггер срыва (опц.) — для `relapse`. Свободное поле «без ПДн». */
  triggerTag: string | null;
  /** Заметка (опц.) — для `relapse`. Свободное поле «без ПДн». */
  note: string | null;

  // ── reschedule / plan ──
  /** Прежний старт попытки (unix ms) — для `reschedule`. */
  fromStartedAt: number | null;
  /** Новый (будущий) старт (unix ms) — для `reschedule`/`plan`. */
  toStartedAt: number | null;
  /** Сколько продержался до переноса (дней) — для `reschedule`. */
  heldDays: number | null;

  // ── goal_reached ──
  /** Ярлык достигнутого порога (`неделя`/`месяц`/`год`/`+7д`…) — для `goal_reached`. */
  thresholdLabel: string | null;
  /** Номинал порога в днях на момент достижения — для `goal_reached`. */
  thresholdDays: number | null;

  /** Когда записано (иммутабельно). */
  createdAt: Date;
}

/**
 * AntiHabitRelapseFull — рецидив (срыв) анти-привычки (domain-model §7; колонки 1:1 со
 * схемой `anti_habit_relapses`, ADR-0033). Append-only журнал попыток: каждый срыв
 * фиксирует, сколько продержалась завершившаяся попытка (`attemptDurationMs`) и опц.
 * триггер/заметку для саморефлексии. Тон non-punitive — это «новая попытка», не провал.
 */
export interface AntiHabitRelapseFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Родительская анти-привычка — FK на `anti_habits.id` (ON DELETE CASCADE). */
  antiHabitId: string;
  /** Момент срыва — unix ms. */
  relapseAt: number;
  /** Сколько продержалась завершившаяся попытка (мс) = relapseAt − startedAt. */
  attemptDurationMs: number;
  /** Триггер срыва (опц.) — для анализа. Свободное поле → подсказка «без ПДн» (ui-ux §9). */
  triggerTag: string | null;
  /** Заметка (опц.). Свободное поле → подсказка «без ПДн» (ui-ux §9). */
  note: string | null;
  /** Когда записано (иммутабельно). */
  createdAt: Date;
}

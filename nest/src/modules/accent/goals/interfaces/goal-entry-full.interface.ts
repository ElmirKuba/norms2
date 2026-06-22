/**
 * GoalEntryFull — запись прогресса цели (domain-model §4; колонки 1:1 со схемой, ADR-0033).
 * **Append-only** (INSERT; не меняется после создания) — отсюда нет `updated_at`. Семантика
 * `value` зависит от рода цели (ADR-0052): для `accumulate` — инкремент «+N» (`currentValue`
 * = Σ); для `reach`/`reduce` — абсолютный замер уровня (`currentValue` = последний). Несколько
 * записей в день разрешены. Владение — через родительскую `goals` (проверяется в домене).
 */
export interface GoalEntryFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Родительская цель — FK на `goals.id` (cascade). */
  goalId: string;
  /** Значение: инкремент (accumulate) или замер уровня (reach/reduce). */
  value: number;
  /** Дата, к которой относится запись (YYYY-MM-DD). */
  occurredOn: string;
  /** Заметка (опц.). */
  note: string | null;
  /** Когда создано. */
  createdAt: Date;
}

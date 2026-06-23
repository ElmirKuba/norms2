/**
 * MilestoneFull — веха цели (domain-model §4; колонки 1:1 со схемой, ADR-0033). Промежуточная
 * отметка внутри цели («25 из 50 книг») с мини-наградой (очки — 2.9). **`reached` НЕ хранится**
 * (ADR-0052): достигнутость вычисляется на чтение как `currentValue ≥ thresholdValue` (·11) —
 * счётчика/`reached_at` нет, гонок нет. Веха неизменна после создания (только add/remove).
 * Владение — через родительскую `goals` (проверяется в домене).
 */
export interface MilestoneFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Родительская цель — FK на `goals.id` (cascade). */
  goalId: string;
  /** Название вехи. */
  title: string;
  /** Порог достижения (в единицах цели; домен сторожит `≤ targetValue`). */
  thresholdValue: number;
  /** Когда создано. */
  createdAt: Date;
}

/**
 * AntiHabitFull — «держусь» (воздержание / «не делаю X»; timer-модель, domain-model §7,
 * колонки 1:1 со схемой `anti_habits`, ADR-0033). В отличие от привычек здесь считается
 * не «сделал больше», а «сколько держусь без срыва»: серия **не хранится**, а вычисляется
 * как `floor((now − currentAttemptStartedAt)/86_400_000)` (фронт считает вживую).
 * `recordDays` — лучшая попытка за всё время; **переживает срыв** (anti-burnout: одна
 * осечка не стирает историю). Рецидив пишется под optimistic `version` (CAS, ADR-0035).
 */
export interface AntiHabitFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Название (что не делаю / от чего воздерживаюсь). */
  title: string;
  /** Описание (опц.). Свободное поле → подсказка «без ПДн» (ui-ux §9). */
  description: string | null;
  /** Активна ли (мягкое отключение из списка). */
  isActive: boolean;
  /** Старт текущей попытки — unix ms. Серия = `floor((now − это)/86_400_000)`. */
  currentAttemptStartedAt: number;
  /** Номер текущей попытки (≥1); растёт на 1 при каждом рецидиве. */
  attemptNumber: number;
  /** Рекорд серии (дней) за всё время — переживает срыв. */
  recordDays: number;
  /** Когда была поставлена рекордная попытка (unix ms) или null (рекорда ещё не было). */
  recordAttemptStartedAt: number | null;
  /** Цель серии в днях (опц., напр. 365) — для кольца прогресса. */
  targetDays: number | null;
  /** Ручной порядок (ADR-0054): drag-to-reorder, per-account; новый — в конец (max+1). */
  position: number;
  /** Версия строки для оптимистичного лока (ADR-0035; рецидив пишется через CAS). */
  version: number;
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}

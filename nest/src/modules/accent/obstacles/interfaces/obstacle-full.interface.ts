/**
 * Виды препятствий — ось «природа проблемы» (ADR-0062, калька двухосевой классификации
 * микро-побед ADR-0056). Обязательное поле: по нему `Recommender` (2.8) подбирает ответ по
 * природе, а не по названию, которое у каждого своё. Хранится строкой-ключом (varchar).
 */
export const OBSTACLE_TYPES = [
  'inner_critic',
  'avoidance',
  'distraction',
  'body',
  'emotion',
  'people',
  'environment',
  'perfectionism',
] as const;

/** Вид препятствия (производно от `OBSTACLE_TYPES`). */
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

/**
 * ObstacleFull — препятствие (per-account; колонки 1:1 со схемой `obstacles`, domain-model §8,
 * ADR-0062). Не свойство характера, а объект с именем, поводом и заранее заготовленными
 * ответами (`Counterplay`). Частота столкновений НЕ хранится — вычисляется на чтение из
 * `obstacle_encounters` (принцип computed-агрегатов, ADR-0052). Инварианты (`intensity` 1..5,
 * длины, лимиты) — на domain-service (2.7·9); CHECK'и в схеме — защита-в-глубину.
 */
export interface ObstacleFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Владелец — FK на `accounts.id` (ON DELETE CASCADE). */
  accountId: string;
  /** Название («Думскролл», «У меня не получится»). Свободное поле «без ПДн» (ADR-0001). */
  name: string;
  /** Вид препятствия — ось «природа проблемы» (обязательна, ADR-0062). */
  type: ObstacleType;
  /**
   * Сфера жизни — вторая ось (опц.); мягкий ключ без FK, общий со целями/привычками/
   * микро-победами (ADR-0056). null = не указана.
   */
  domainKey: string | null;
  /** Повод, по которому приходит («вечер, устал»). Свободное поле «без ПДн». */
  trigger: string | null;
  /** Признаки, по которым узнаёшь («открываю ленту не думая»). Свободное поле «без ПДн». */
  symptoms: string | null;
  /**
   * Насколько давит, 1..5 — **субъективная самооценка на сегодня**, меняется руками.
   * Из частоты столкновений НЕ пересчитывается: одна колонка решает одну задачу (ADR-0062 п.2).
   */
  intensity: number;
  /** Активно ли (`false` = убрано в архив; история при этом цела). */
  isActive: boolean;
  /** Стартовый пример (ADR-0051 «инертная витрина») — до «Добавить себе» столкновения не пишутся. */
  isStarter: boolean;
  /** Ручной порядок (ADR-0054, drag-to-reorder): per-account; новый — в конец (max+1). */
  position: number;
  /** Оптимистичный лок (ADR-0035): любой update bump'ает. */
  version: number;
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}

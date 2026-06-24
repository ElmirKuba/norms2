/**
 * Род цели — как трактуется значение и считается прогресс (domain-model §4, ADR-0052).
 * Хранится строкой-ключом (varchar):
 * - `accumulate` — накопление: `currentValue` = Σ записей, база 0 («прочитать 50 книг»);
 * - `reach` — выйти на уровень: `currentValue` = последний замер («15 подтягиваний»);
 * - `reduce` — снизить: то же, что `reach`, но `target < startValue` («курить 0»);
 * - `maintain` — удерживать уровень в коридоре `[startValue, targetValue]` (ADR-0052): прогресс
 *   = **доля замеров в коридоре** за окно (adherence); без авто-завершения и прогноза-к-дате
 *   («вес 75–78», «экран ≤1ч» с ниж=0).
 *
 * `reduce` математически = `reach` с `target<start` (общая формула доли `f`); отдельный
 * ключ оставлен ради тона forecast и валидации-подсказок (ADR-0052). `maintain` — отдельная
 * семантика (коридор+adherence), не сводится к `f`-доле.
 */
export const GOAL_DIRECTIONS = ['accumulate', 'reach', 'reduce', 'maintain'] as const;

/** Род цели (производно от `GOAL_DIRECTIONS`). */
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number];

/**
 * Статус цели (domain-model §4): `active` — в работе; `paused` — не принимает записи и
 * не участвует в forecast; `completed` — достигнута (видна, не удаляется); `archived` —
 * убрана из дашборда.
 */
export const GOAL_STATUSES = ['active', 'paused', 'completed', 'archived'] as const;

/** Статус цели (производно от `GOAL_STATUSES`). */
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/**
 * Период паузы цели (элемент `pauseHistory`, jsonb). `pausedAt`/`resumedAt` — ISO-строки;
 * `resumedAt=null` для текущей незавершённой паузы. Нужно для подсчёта `activeDays`
 * (дни минус паузы) в forecast.
 */
export interface GoalPausePeriod {
  /** Начало паузы (ISO). */
  pausedAt: string;
  /** Конец паузы (ISO) или null, если пауза ещё идёт. */
  resumedAt: string | null;
}

/**
 * GoalFull — цель (колонки 1:1 со схемой, ADR-0033). Per-account намерение с измеримым
 * результатом. **Без `version`-колонки** — счётчиков не храним: `currentValue/percentage/
 * pace/forecast/rollup` вычисляются на чтение из `goal_entries`/подцелей (ADR-0052), гонок
 * нет. Единственный modify-инвариант (авто-`completed`) — атомарный conditional-update.
 * Подцель = `Goal` с `parentGoalId` (иерархия C+, глубина из `ACCENT_GOAL_MAX_DEPTH`).
 */
export interface GoalFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Родительская цель (`goals.id`) или null — корневая. Подцель = та же `Goal`. */
  parentGoalId: string | null;
  /** Название. */
  title: string;
  /** Зачем это важно (мотив-якорь, опц.). */
  whyItMatters: string | null;
  /** Ключ сферы (`accent_domains.key`) или null. */
  domainKey: string | null;
  /** Ключи RPG-атрибутов (0..N; `accent_attributes.key`). */
  attributes: string[];
  /** Род цели (как считается прогресс). */
  direction: GoalDirection;
  /** Единица измерения (книги, кг, км, …). */
  unit: string;
  /** Целевое значение. accumulate: `>0`; reach/reduce: `≠ startValue`. */
  targetValue: number;
  /** Базовый замер для reach/reduce (иммутабелен); null → база из первой записи. */
  startValue: number | null;
  /** Дедлайн (календарная дата YYYY-MM-DD) или null. */
  deadline: string | null;
  /** Статус жизненного цикла. */
  status: GoalStatus;
  /** Когда достигнута (фиксируется один раз) или null. */
  completedAt: Date | null;
  /** Текст «версия цели на плохой день» (anti-burnout, опц.). */
  fallbackVersion: string | null;
  /** «Ради чего откажусь» (mission-filter, ADR-0053): условно-обязателен при заводе accumulate в фокус. */
  tradeoff: string | null;
  /** Стартовый пример (`is_starter`, ADR-0051): виден в списке с бейджем «пример», но НЕ
   * считается «в работе» (исключён из дашборда) и не принимает записи до присвоения
   * («Добавить себе» / «Изм.»). Инертная витрина. */
  isStarter: boolean;
  /** Фокус (ADR-0053, 2.5·24): null = не в фокусе; не-null = в фокусе + ранг (порядок внутри фокуса). */
  focusOrder: number | null;
  /** Ручной порядок в списке (ADR-0054, 2.5·27): drag-to-reorder, per-account. */
  position: number;
  /** Начало текущей паузы (ISO) или null. */
  pausedAt: Date | null;
  /** История пауз (для `activeDays` в forecast). */
  pauseHistory: GoalPausePeriod[];
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}

import type { GoalFull } from './interfaces/goal-full.interface';

/** Вычисляемый прогресс цели (ADR-0052) — наружу в `GoalProgressView`. */
export interface GoalProgress {
  /** Текущее значение (Σ для accumulate; последний замер для reach/reduce) или null. */
  currentValue: number | null;
  /** Процент 0..100 (round доли `f`) или null (нельзя посчитать). */
  percentage: number | null;
  /** Дней до дедлайна (может быть отрицательным = просрочка) или null. */
  daysLeft: number | null;
  /** Темп — единиц в активный день или null. */
  pace: number | null;
  /** Прогноз к сроку (цвет UI): ahead/on_track/behind/null. Тон копирайта — проективный. */
  forecast: 'ahead' | 'on_track' | 'behind' | null;
  /** «При текущем темпе — к этой дате» (YYYY-MM-DD) или null. */
  projectedCompletionDate: string | null;
}

const DAY_MS = 86_400_000;
/** Допуск сравнения темпов (±5%) для on_track. */
const RATE_EPS = 0.05;

/** YYYY-MM-DD → UTC-полночь (мс). «Пространство дат» — без tz-сдвигов (как recurrence util). */
function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** UTC-полночь (мс) → YYYY-MM-DD. */
function utcMsToYmd(ms: number): string {
  const d = new Date(ms);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

/** Зажимает в [0,1]. */
function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Доля прогресса `f ∈ [0,1]` (direction-aware, ADR-0052). accumulate: current/target;
 * reach/reduce: (current−base)/(target−base) — знаменатель несёт знак (рост и снижение
 * одной формулой). null, если посчитать нельзя (нет current/base или вырожденный знаменатель).
 * @param goal Цель.
 * @param currentValue Текущее значение или null.
 * @param base База (startValue ?? первый замер) или null.
 * @returns Доля [0,1] или null.
 */
export function progressFraction(
  goal: Pick<GoalFull, 'direction' | 'targetValue'>,
  currentValue: number | null,
  base: number | null,
): number | null {
  if (currentValue === null) {
    return null;
  }
  if (goal.direction === 'accumulate') {
    if (goal.targetValue === 0) {
      return null;
    }
    return clamp01(currentValue / goal.targetValue);
  }
  if (base === null) {
    return null;
  }
  const denom = goal.targetValue - base;
  if (denom === 0) {
    return null;
  }
  return clamp01((currentValue - base) / denom);
}

/**
 * Достигнута ли цель (незажатая доля ≥ 1). Для авто-`completed` (ADR-0052).
 * @param goal Цель.
 * @param currentValue Текущее значение или null.
 * @param base База или null.
 * @returns true, если достигнута.
 */
export function isGoalReached(
  goal: Pick<GoalFull, 'direction' | 'targetValue'>,
  currentValue: number | null,
  base: number | null,
): boolean {
  if (currentValue === null) {
    return false;
  }
  if (goal.direction === 'accumulate') {
    return currentValue >= goal.targetValue;
  }
  if (base === null) {
    return false;
  }
  const denom = goal.targetValue - base;
  if (denom === 0) {
    return false;
  }
  return (currentValue - base) / denom >= 1;
}

/**
 * Достигнута ли веха (direction-aware, ADR-0052). Веха пройдена, когда текущее значение
 * дошло до её порога **в нужную сторону**: accumulate/reach (рост) — `current ≥ threshold`;
 * reduce (снижение, `target<base`) — `current ≤ threshold`.
 * @param goal Цель (род + цель/база определяют направление).
 * @param thresholdValue Порог вехи.
 * @param currentValue Текущее значение или null.
 * @param base База (для reach/reduce) или null.
 * @returns true, если веха достигнута.
 */
export function isMilestoneReached(
  goal: Pick<GoalFull, 'direction' | 'targetValue'>,
  thresholdValue: number,
  currentValue: number | null,
  base: number | null,
): boolean {
  if (currentValue === null) {
    return false;
  }
  // Направление: reduce при target<base → идём вниз; иначе вверх (accumulate base=0).
  const goingDown =
    goal.direction === 'reduce' && base !== null && goal.targetValue < base;
  return goingDown ? currentValue <= thresholdValue : currentValue >= thresholdValue;
}

/**
 * Считает весь вычисляемый прогресс цели (ADR-0052). forecast — в пространстве доли `f`
 * (observedRate=f/activeDays vs requiredRate=(1−f)/daysLeft), едино для всех direction.
 * `activeDays` = прожитые дни минус паузы (из `pauseHistory` + текущая открытая).
 * @param goal Цель (несёт deadline/createdAt/паузы).
 * @param currentValue Текущее значение или null.
 * @param base База (startValue ?? первый замер) или null.
 * @param todayYmd Сегодня в TZ пользователя (YYYY-MM-DD).
 * @param now Текущий момент (для activeDays).
 * @returns Вычисляемый прогресс.
 */
export function computeGoalProgress(
  goal: GoalFull,
  currentValue: number | null,
  base: number | null,
  todayYmd: string,
  now: Date,
): GoalProgress {
  const f = progressFraction(goal, currentValue, base);
  const percentage = f === null ? null : Math.round(f * 100);

  const daysLeft =
    goal.deadline === null
      ? null
      : Math.round((ymdToUtcMs(goal.deadline) - ymdToUtcMs(todayYmd)) / DAY_MS);

  // activeDays = прожитые дни минус паузы (≥1).
  const elapsedMs = Math.max(0, now.getTime() - goal.createdAt.getTime());
  let pausedMs = 0;
  for (const period of goal.pauseHistory) {
    const a = Date.parse(period.pausedAt);
    const b = period.resumedAt === null ? now.getTime() : Date.parse(period.resumedAt);
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      pausedMs += Math.max(0, b - a);
    }
  }
  if (goal.pausedAt !== null) {
    pausedMs += Math.max(0, now.getTime() - goal.pausedAt.getTime());
  }
  const activeDays = Math.max(1, (elapsedMs - pausedMs) / DAY_MS);
  const pace = currentValue === null ? null : currentValue / activeDays;

  let forecast: GoalProgress['forecast'] = null;
  let projectedCompletionDate: string | null = null;
  if (f !== null && f < 1) {
    const observedRate = f / activeDays;
    if (observedRate > 0) {
      const daysToFinish = (1 - f) / observedRate;
      projectedCompletionDate = utcMsToYmd(
        ymdToUtcMs(todayYmd) + Math.ceil(daysToFinish) * DAY_MS,
      );
    }
    if (daysLeft !== null) {
      if (daysLeft <= 0) {
        forecast = 'behind';
      } else {
        const requiredRate = (1 - f) / daysLeft;
        if (observedRate > requiredRate * (1 + RATE_EPS)) {
          forecast = 'ahead';
        } else if (observedRate < requiredRate * (1 - RATE_EPS)) {
          forecast = 'behind';
        } else {
          forecast = 'on_track';
        }
      }
    }
  }

  return { currentValue, percentage, daysLeft, pace, forecast, projectedCompletionDate };
}

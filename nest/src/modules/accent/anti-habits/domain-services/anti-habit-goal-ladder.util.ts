/**
 * Авто-эскалация цели «держусь» по КАЛЕНДАРНОЙ лестнице (ADR-0060). Цель — не число дней, а
 * ДАТА ближайшего непройденного порога. Пороги: дневные (`старт + N дней`) и календарные
 * (`старт + N месяцев/лет` с клампом к концу месяца — «зеркальное число»). После «года» —
 * «морковка»: каждый следующий порог = дата «года» + 7·k дней. Ручная цель (`targetDays`) —
 * стартовая ступень (пол), не потолок. Чистые функции (без побочных эффектов).
 */

/** Число миллисекунд в сутках. */
const DAY_MS = 86_400_000;

/** Ступень лестницы наружу: ярлык + номинал в днях + целевая ДАТА (unix ms). */
export interface GoalRung {
  /** Ярлык порога (`неделя`/`месяц`/`год`/`год + 7 дн`…). */
  label: string;
  /** Номинал порога в днях (для сортировки/пола ручной цели/отображения). */
  thresholdDays: number;
  /** Целевая дата (unix ms). */
  targetDate: number;
}

/** Описание ступени базовой лестницы (до вычисления даты). */
interface RungSpec {
  /** Ярлык. */
  label: string;
  /** Номинал в днях (для пола ручной цели и отображения). */
  days: number;
  /** Смещение: `day` — старт+days; `month` — старт+months календарных (кламп к концу месяца). */
  kind: 'day' | 'month';
  /** Календарных месяцев (для `month`). */
  months?: number;
}

/** Базовая лестница (ADR-0060), по возрастанию. */
const LADDER: readonly RungSpec[] = [
  { label: '1 день', days: 1, kind: 'day' },
  { label: '3 дня', days: 3, kind: 'day' },
  { label: '5 дней', days: 5, kind: 'day' },
  { label: 'неделя', days: 7, kind: 'day' },
  { label: '2 недели', days: 14, kind: 'day' },
  { label: '3 недели', days: 21, kind: 'day' },
  { label: 'месяц', days: 30, kind: 'month', months: 1 },
  { label: '40 дней', days: 40, kind: 'day' },
  { label: '50 дней', days: 50, kind: 'day' },
  { label: '2 месяца', days: 60, kind: 'month', months: 2 },
  { label: '3 месяца', days: 90, kind: 'month', months: 3 },
  { label: 'полгода', days: 180, kind: 'month', months: 6 },
  { label: 'три квартала', days: 270, kind: 'month', months: 9 },
  { label: 'год', days: 365, kind: 'month', months: 12 },
];

/** Спецификация «года» — последняя ступень лестницы (база для «морковки»). */
const YEAR_SPEC: RungSpec = LADDER[LADDER.length - 1] as RungSpec;

/**
 * Прибавляет `months` календарных месяцев к дате с клампом к концу месяца («зеркальное число»):
 * старт 31 марта + 1 мес = 30 апреля; 31 января + 1 мес = 28/29 февраля. Время суток сохраняется.
 * @param date Исходная дата.
 * @param months Сколько месяцев прибавить (≥0).
 * @returns Новая дата.
 */
export function addMonthsClamp(date: Date, months: number): Date {
  const total = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(total / 12);
  const targetMonth = ((total % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(date.getDate(), lastDay);
  const result = new Date(date);
  result.setFullYear(targetYear, targetMonth, clampedDay);
  return result;
}

/**
 * Целевая дата ступени от старта серии.
 * @param spec Описание ступени.
 * @param startedAtMs Старт серии (unix ms).
 * @returns Дата порога (unix ms).
 */
function rungDate(spec: RungSpec, startedAtMs: number): number {
  if (spec.kind === 'month') {
    return addMonthsClamp(new Date(startedAtMs), spec.months ?? 0).getTime();
  }
  return startedAtMs + spec.days * DAY_MS;
}

/**
 * `k`-я ступень «морковки» после года: дата «года» + 7·k дней; номинал в днях — от старта.
 * @param startedAtMs Старт серии (unix ms).
 * @param k Номер шага (≥1).
 * @returns Ступень «морковки».
 */
function carrotRung(startedAtMs: number, k: number): GoalRung {
  const targetDate = rungDate(YEAR_SPEC, startedAtMs) + 7 * k * DAY_MS;
  return {
    label: `год + ${7 * k} дн`,
    thresholdDays: Math.round((targetDate - startedAtMs) / DAY_MS),
    targetDate,
  };
}

/**
 * Следующий непройденный порог авто-цели (ближайшая пороговая ДАТА строго после `nowMs`).
 * @param startedAtMs Старт текущей серии (unix ms).
 * @param nowMs Текущий момент (unix ms).
 * @param manualTargetDays Ручная цель-пол (дней) или null — рассматриваем ступени `days ≥ пол`.
 * @returns Следующая ступень (после «года» — «морковка» +7 дней бесконечно).
 */
export function nextGoal(
  startedAtMs: number,
  nowMs: number,
  manualTargetDays: number | null = null,
): GoalRung {
  const floor = manualTargetDays ?? 0;
  for (const spec of LADDER) {
    if (spec.days < floor) {
      continue;
    }
    const targetDate = rungDate(spec, startedAtMs);
    if (targetDate > nowMs) {
      return { label: spec.label, thresholdDays: spec.days, targetDate };
    }
  }
  // После «года» — «морковка» (первая ступень строго в будущем).
  let k = 1;
  let rung = carrotRung(startedAtMs, k);
  while (rung.targetDate <= nowMs) {
    k += 1;
    rung = carrotRung(startedAtMs, k);
  }
  return rung;
}

/**
 * Пороги, ДОСТИГНУТЫЕ к `nowMs` (targetDate ≤ now), которые ещё НЕ отмечены (`days >
 * sinceThresholdDays`) и не ниже ручного пола. По возрастанию — для материализации событий
 * `goal_reached` в правильном хронологическом порядке (idempotent через `sinceThresholdDays`).
 * @param startedAtMs Старт текущей серии (unix ms).
 * @param nowMs Текущий момент (unix ms).
 * @param manualTargetDays Ручная цель-пол (дней) или null.
 * @param sinceThresholdDays Максимальный уже отмеченный порог (дней) для этой попытки (0 если нет).
 * @returns Новые достигнутые ступени (по возрастанию).
 */
export function reachedGoals(
  startedAtMs: number,
  nowMs: number,
  manualTargetDays: number | null,
  sinceThresholdDays: number,
): GoalRung[] {
  const floor = manualTargetDays ?? 0;
  const out: GoalRung[] = [];
  for (const spec of LADDER) {
    if (spec.days < floor || spec.days <= sinceThresholdDays) {
      continue;
    }
    const targetDate = rungDate(spec, startedAtMs);
    if (targetDate <= nowMs) {
      out.push({ label: spec.label, thresholdDays: spec.days, targetDate });
    }
  }
  // «Морковка» после года: добавляем ступени, пока их дата ≤ now.
  for (let k = 1; ; k++) {
    const rung = carrotRung(startedAtMs, k);
    if (rung.targetDate > nowMs) {
      break;
    }
    if (rung.thresholdDays > sinceThresholdDays && rung.thresholdDays >= floor) {
      out.push(rung);
    }
  }
  return out;
}

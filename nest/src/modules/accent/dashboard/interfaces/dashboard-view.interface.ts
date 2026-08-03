import type { DashboardNow } from './dashboard-now.interface';

/** Задача дня в короткой сводке дашборда (полный чеклист — на `/accent/habits`). */
export interface DashboardTaskItem {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Статус (`pending`/`done`/`partial`/`skipped`). */
  status: string;
}

/** Блок «Сегодня»: процент дня и короткий список. */
export interface DashboardToday {
  /** Сколько задач в дне (без пропущенных). */
  total: number;
  /** Сколько закрыто (`done`/`partial`). */
  done: number;
  /** Процент дня (0..100). */
  percent: number;
  /** До пяти задач для беглого взгляда. */
  items: DashboardTaskItem[];
}

/** Цель в сводке (фокусные идут первыми). */
export interface DashboardGoalItem {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Процент выполнения или null (нечего считать). */
  percentage: number | null;
  /** В фокусе ли ([ADR-0053](../../../../../docs/decisions/0053-goal-focus-and-mission-filter.md)). */
  isFocus: boolean;
}

/** «Держусь» в сводке. */
export interface DashboardAntiHabitItem {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /**
   * Момент старта текущей попытки (unix ms). Отдаём **момент, а не число дней**: счётчик тикает
   * на фронте, как на экране «Держусь», иначе снимок устареет через минуту после загрузки.
   */
  currentAttemptStartedAt: number;
}

/** Просроченная разовая задача. */
export interface DashboardOverdueItem {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Дедлайн (ISO). */
  deadline: string;
}

/**
 * Три шага пустого экрана. Все `true` — чек-лист исчезает; кнопка живёт только у первого
 * невыполненного шага: путь видно целиком, а делать нужно одно.
 */
export interface DashboardOnboarding {
  /** Есть хотя бы одна своя привычка (не пример-витрина). */
  hasHabits: boolean;
  /** Хоть раз что-то отмечал (задача или микро-победа). */
  hasFirstCompletion: boolean;
  /** Есть хотя бы одна своя цель. */
  hasGoals: boolean;
}

/**
 * Снимок главного экрана (2.11) — всё за один запрос: согласованное состояние дня и один поход
 * по сети. Собирается use-case'ом через domain-services соседних областей (кросс-домен вниз).
 *
 * **Дашборд аддитивен:** чек-ин и рекомендации (2.8), XP и серии (2.9), неделя (2.10) досыпят
 * свои поля позже, не переделывая существующие.
 */
export interface DashboardView {
  /** Герой экрана: одно дело и одна кнопка. */
  now: DashboardNow;
  /** Блок «Сегодня». */
  today: DashboardToday;
  /** Активные цели, фокусные первыми (до 5). */
  goals: DashboardGoalItem[];
  /** Идущие «держусь» (до 3). */
  antiHabits: DashboardAntiHabitItem[];
  /** Просроченные разовые задачи. */
  overdue: DashboardOverdueItem[];
  /** Есть ли свои препятствия — от этого зависит строка «накрыло? → Столкнулся». */
  hasObstacles: boolean;
  /** Шаги первого знакомства. */
  onboarding: DashboardOnboarding;
  /** Раздел на паузе с (ISO) или null. */
  pausedFrom: string | null;
}

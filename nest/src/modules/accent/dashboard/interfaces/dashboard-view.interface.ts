import type { DashboardNow } from './dashboard-now.interface';
import type { PersistenceView } from '../../progress/interfaces/persistence.interface';

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

/** Свежеполученное достижение для строки на дашборде. */
export interface DashboardAchievement {
  /** Код из каталога. */
  code: string;
  /** Название. */
  title: string;
  /** Деталь момента («после 12 дней тишины») или null. */
  context: string | null;
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
  /**
   * Постоянство (2.9): итог «дней с действием» и окно «X из последних 7». На дашборде — одна
   * плитка на бегу; вся картина, включая привычки по отдельности, живёт на `/accent/stats`.
   */
  persistence: PersistenceView;
  /**
   * Только что полученное достижение или null (2.9·14). **Событие, а не блок:** живёт пару дней
   * и исчезает само. Награду человек встречает там, где бывает каждый день, а разбирать её
   * идёт в «Статистику» — иначе главный экран превратится в витрину.
   */
  freshAchievement: DashboardAchievement | null;
  /** Шаги первого знакомства. */
  onboarding: DashboardOnboarding;
  /** Раздел на паузе с (ISO) или null. */
  pausedFrom: string | null;
}

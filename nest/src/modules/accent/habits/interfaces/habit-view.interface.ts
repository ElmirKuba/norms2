import type { HabitFull, HabitKind, LadderDirection, LadderPolicy } from './habit-full.interface';

/** Лесенка наружу — цели + политика (без внутренних счётчиков easyStreak/missStreak). */
export interface LadderView {
  /** Минимальная победа. */
  minTarget: number;
  /** Текущая дневная цель. */
  currentTarget: number;
  /** Потолок или null. */
  goalTarget: number | null;
  /** Шаг подъёма/отката или null. */
  step: number | null;
  /** Политика. */
  policy: LadderPolicy;
  /** Полярность (ADR-0058); `raise` по умолчанию. */
  direction: LadderDirection;
  /** Вечерний якорь (минуты от полуночи) для `clock` или null. */
  anchorMinutes: number | null;
}

/** HabitView — привычка наружу (без `accountId`/таймстампов; счётчики лесенки скрыты). */
export interface HabitView {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Описание или null. */
  description: string | null;
  /** Иконка или null. */
  icon: string | null;
  /** Ключ сферы или null. */
  domainKey: string | null;
  /** Ключи RPG-атрибутов. */
  attributes: string[];
  /** Привязка к цели или null. */
  goalId: string | null;
  /** Приоритет. */
  priority: number;
  /** Тип измерения. */
  kind: HabitKind;
  /** Расписание (RRULE). */
  recurrence: string;
  /** Дата старта расписания `YYYY-MM-DD` или null (якорь для «каждые N дней»/чередования). */
  startDate: string | null;
  /** Активна ли. */
  isActive: boolean;
  /** Стартовый пример (бейдж «пример»; не материализует задачи до присвоения). */
  isStarter: boolean;
  /** Лесенка (цели + политика). */
  ladder: LadderView;
  /** Текст «минимум плохого дня» или null. */
  minVersion: string | null;
  /** Время подготовки (сек) перед timed-таймером или null (FEAT-H1). */
  prepSeconds: number | null;
}

/**
 * Проецирует доменную привычку в наружную view (скрывает easyStreak/missStreak).
 * @param full Доменная сущность.
 * @returns Проекция наружу.
 */
export function toHabitView(full: HabitFull): HabitView {
  return {
    id: full.id,
    title: full.title,
    description: full.description,
    icon: full.icon,
    domainKey: full.domainKey,
    attributes: full.attributes,
    goalId: full.goalId,
    priority: full.priority,
    kind: full.kind,
    recurrence: full.recurrence,
    startDate: full.startDate,
    isActive: full.isActive,
    isStarter: full.isStarter,
    ladder: {
      minTarget: full.ladder.minTarget,
      currentTarget: full.ladder.currentTarget,
      goalTarget: full.ladder.goalTarget,
      direction: full.ladder.direction ?? 'raise',
      anchorMinutes: full.ladder.anchorMinutes ?? null,
      step: full.ladder.step,
      policy: full.ladder.policy,
    },
    minVersion: full.minVersion,
    prepSeconds: full.prepSeconds,
  };
}

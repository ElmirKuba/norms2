/**
 * Тип привычки — как измеряется выполнение (domain-model §5). Хранится строкой-ключом
 * (varchar): `binary` (сделал/нет), `quantitative` (счётное, напр. отжимания),
 * `timed` (по времени, напр. секунды медитации).
 */
export const HABIT_KINDS = ['binary', 'quantitative', 'timed'] as const;

/** Тип привычки (производно от `HABIT_KINDS`). */
export type HabitKind = (typeof HABIT_KINDS)[number];

/** Политика лесенки: `manual` — планку двигает пользователь, `adaptive` — `LadderEngine`. */
export const LADDER_POLICIES = ['manual', 'adaptive'] as const;

/** Политика лесенки (производно от `LADDER_POLICIES`). */
export type LadderPolicy = (typeof LADDER_POLICIES)[number];

/**
 * Лесенка привычки (встроенный value-object, ядро адаптивности — ADR-0027 R2,
 * алгоритм gamification §7). Хранится как jsonb-колонка `ladder`.
 */
export interface HabitLadder {
  /** Минимальная победа (плохой день): binary=1, quantitative=напр. 1, timed=напр. 60. */
  minTarget: number;
  /** Текущая дневная цель привычки. */
  currentTarget: number;
  /** Желаемый потолок (напр. 100 отжиманий) или null. */
  goalTarget: number | null;
  /** Шаг подъёма/отката (для adaptive) или null. */
  step: number | null;
  /** Политика подстройки. */
  policy: LadderPolicy;
  /** Счётчик подряд «лёгких» выполнений (для подъёма; LadderEngine §7). */
  easyStreak: number;
  /** Счётчик подряд недоборов (для мягкого отката; LadderEngine §7). */
  missStreak: number;
}

/**
 * HabitFull — привычка (TaskTemplate; колонки 1:1 со схемой, ADR-0033). Per-account
 * шаблон повторяющегося дела с расписанием (RRULE) и лесенкой. Задачи дня (`Task`)
 * материализуются из активных привычек. `goalId` — привязка к цели (FK появится с
 * таблицей `goals`, 2.5); `attributes[]` — ключи RPG-атрибутов (каталог 2.1).
 */
export interface HabitFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Название. */
  title: string;
  /** Описание (опц.). */
  description: string | null;
  /** Иконка/эмодзи (опц.). */
  icon: string | null;
  /** Ключ сферы (`accent_domains.key`) или null. */
  domainKey: string | null;
  /** Ключи RPG-атрибутов (0..N; `accent_attributes.key`). */
  attributes: string[];
  /** Привязка к цели (`goals.id`) или null — выполнение даёт прогресс цели (2.5). */
  goalId: string | null;
  /** Приоритет (сортировка; больше = выше). */
  priority: number;
  /** Тип измерения. */
  kind: HabitKind;
  /** Расписание — строка RRULE (iCalendar). */
  recurrence: string;
  /** Дата старта расписания `YYYY-MM-DD` (якорь dtstart для INTERVAL-правил) или null →
   * фолбэк на дату создания в TZ аккаунта. Позволяет «начать не сегодня» / чередовать (BUG-2). */
  startDate: string | null;
  /** Активна ли (мягкое отключение из материализации). */
  isActive: boolean;
  /** Стартовый пример (`is_starter`): виден в «Шаблонах» с бейджем, но НЕ материализует
   * задачи и не двигает лесенку до присвоения («Добавить себе»/«Изм.»). ADR-0051. */
  isStarter: boolean;
  /** Лесенка (встроенный объект). */
  ladder: HabitLadder;
  /** Текст «минимум плохого дня» (опц.). */
  minVersion: string | null;
  /** Версия строки для оптимистичного лока (ADR-0035; движок лесенки пишет через CAS). */
  version: number;
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}

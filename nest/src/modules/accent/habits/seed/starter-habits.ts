import type { HabitKind, HabitLadder } from '../interfaces/habit-full.interface';

/** Шаблон стартовой привычки (без `accountId`/`isStarter` — подставляются при севе). */
export interface StarterHabit {
  /** Название. */
  title: string;
  /** Иконка/эмодзи. */
  icon: string | null;
  /** Описание (зачем). */
  description: string | null;
  /** Тип измерения. */
  kind: HabitKind;
  /** Расписание (RRULE). */
  recurrence: string;
  /** Лесенка (со счётчиками 0 — стартовое состояние). */
  ladder: HabitLadder;
  /** Ключи RPG-атрибутов. */
  attributes: string[];
  /** Текст «минимум плохого дня» (worded «пол»). */
  minVersion: string | null;
}

/**
 * Стартовый набор привычек — заводится **по кнопке** «Получить пак привычек»
 * (`POST /accent/habits/starter-pack`), идемпотентно по дедупу названий (только
 * докидывает недостающие). Сеются как примеры (`is_starter=true`): видны в «Шаблонах»
 * с бейджем, но НЕ материализуют задачи и не двигают лесенку до присвоения
 * («Добавить себе»/«Изм.») — инертная витрина (ADR-0051).
 *
 * Сознательно **anti-burnout**: низкий `minTarget` (1), адаптивная лесенка от смешного
 * минимума к цели, у каждой — worded `minVersion` (что делать в худший день). Учат
 * хорошим дефолтам на примере (философия раздела: расти без надрыва, не обнуляться).
 * Курировано мало (5) — привычка это обязательство, много примеров = паралич выбора.
 */
export const STARTER_HABITS: readonly StarterHabit[] = [
  {
    title: 'Отжимания',
    icon: '💪',
    description: 'Каждый день немного — тело привыкает само.',
    kind: 'quantitative',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 3, goalTarget: 30, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['strength', 'discipline'],
    minVersion: 'В худший день — 1 отжимание. Серия не рвётся.',
  },
  {
    title: 'Чтение',
    icon: '📖',
    description: 'Несколько страниц в день складываются в книги за год.',
    kind: 'quantitative',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 2, goalTarget: 10, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['intellect', 'discipline'],
    minVersion: 'Хотя бы один абзац.',
  },
  {
    title: 'Дыхание / тишина',
    icon: '🧘',
    description: 'Минута спокойствия среди дня сбивает тревогу.',
    kind: 'timed',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 3, goalTarget: 15, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['spirit', 'health'],
    minVersion: '5 медленных вдохов.',
  },
  {
    title: 'Прогулка',
    icon: '🚶',
    description: 'Свет и движение перезапускают день.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['health'],
    minVersion: 'Выйти хотя бы на 5 минут.',
  },
  {
    title: 'Лечь вовремя',
    icon: '🛏',
    description: 'Сон — фундамент всего остального.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['health', 'discipline'],
    minVersion: 'Лечь хотя бы на 15 минут раньше обычного.',
  },
];

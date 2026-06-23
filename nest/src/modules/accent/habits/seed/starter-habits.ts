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
 * Курировано **22** — широкий охват сфер (движение / разминка / ум / язык / дух / молитва / здоровье /
 * витамины / питание / связь / деньги / **отказ — цифровая тишина, утро без телефона, алкоголь,
 * сигареты, сладкое** как ядро «тренажёра отказа», ADR-0049), но не свалка: каждая
 * привычка — осмысленный дефолт, а не «добей до числа». По аналогии с расширением
 * стартового пака микро-побед (2.4). Это **примеры**, человек берёт нужное, остальное чистит.
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
  {
    title: 'Вода',
    icon: '💧',
    description: 'Тело работает лучше, когда не обезвожено.',
    kind: 'quantitative',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 3, goalTarget: 8, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['health'],
    minVersion: 'Один стакан воды.',
  },
  {
    title: 'Дневник / благодарность',
    icon: '📓',
    description: 'Одна записанная мысль разгружает голову (внешняя память).',
    kind: 'quantitative',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: 3, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['spirit', 'intellect'],
    minVersion: 'Одна строка — за что благодарен или что заметил.',
  },
  {
    title: 'Учёба / навык',
    icon: '🎓',
    description: 'Малыми дозами осваивается что угодно.',
    kind: 'timed',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 10, goalTarget: 60, step: 5, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['intellect', 'discipline'],
    minVersion: '5 минут над навыком — и хватит.',
  },
  {
    title: 'Цифровая тишина',
    icon: '📵',
    description: 'Время без ленты — тренировка отказа от лишнего.',
    kind: 'timed',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 15, goalTarget: 90, step: 5, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['discipline', 'spirit'],
    minVersion: '10 минут без телефона.',
  },
  {
    title: 'Порядок',
    icon: '🧹',
    description: 'Одна прибранная зона в день — и дом не зарастает.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['discipline', 'health'],
    minVersion: 'Вернуть одну вещь на место.',
  },
  {
    title: 'Связь с близким',
    icon: '💬',
    description: 'Отношения держатся на маленьких касаниях.',
    kind: 'binary',
    recurrence: 'FREQ=WEEKLY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['social'],
    minVersion: 'Короткое сообщение одному близкому.',
  },
  {
    title: 'Утро без телефона',
    icon: '🌅',
    description: 'Не отдавать первые минуты дня ленте — день начинается с тебя.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['discipline', 'spirit'],
    minVersion: 'Не хватать телефон 10 минут после пробуждения.',
  },
  {
    title: 'Маленькое добро',
    icon: '🙋',
    description: 'Одно доброе действие в день — мышца, которую стоит качать.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['social', 'spirit'],
    minVersion: 'Сказать кому-то спасибо от души.',
  },
  {
    title: 'Записать траты',
    icon: '🧾',
    description: 'Видеть, куда уходят деньги — первый шаг к контролю над ними.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['discipline', 'intellect'],
    minVersion: 'Одна строка: на что ушли деньги.',
  },
  {
    title: 'Овощ или фрукт',
    icon: '🥗',
    description: 'Что-то живое в тарелке каждый день.',
    kind: 'quantitative',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: 3, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['health'],
    minVersion: 'Один укус зелёного.',
  },
  {
    title: 'Новые слова / язык',
    icon: '🗣',
    description: 'По чуть-чуть — и через год говоришь.',
    kind: 'quantitative',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 5, goalTarget: 20, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['intellect', 'discipline'],
    minVersion: 'Одно новое слово или карточка.',
  },
  {
    title: 'День без сладкого',
    icon: '🚫',
    description: 'Отказ от лишнего — та же тренируемая мышца.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['discipline', 'health'],
    minVersion: 'Отказаться от сладкого хотя бы один раз за день.',
  },
  {
    title: 'Витамины',
    icon: '💊',
    description: 'То, что назначено/по плану — стабильно, без пропусков.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['health'],
    minVersion: 'Принять хотя бы основное по плану.',
  },
  {
    title: 'Без алкоголя',
    icon: '🍷',
    description: 'День трезвости — тренировка отказа и подарок завтрашнему себе.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['discipline', 'health'],
    minVersion: 'Сегодня — ни глотка.',
  },
  {
    title: 'Без сигарет',
    icon: '🚭',
    description: 'Отказ — главная мышца. Сорвался — отметь честно, не обнуляйся.',
    kind: 'binary',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 1, goalTarget: null, step: null, policy: 'manual', easyStreak: 0, missStreak: 0 },
    attributes: ['discipline', 'health'],
    // NB: бросание курения точнее ляжет в AntiHabit «держусь» (2.6, серия «не курю N дней»);
    // здесь — дневная форма «день без сигарет». При желании смигрировать на 2.6.
    minVersion: 'Продержаться этот день.',
  },
  {
    title: 'Зарядка / разминка',
    icon: '🤸',
    description: 'Размять тело — отдельно от силы и прогулки: суставы, шея, спина.',
    kind: 'timed',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 5, goalTarget: 15, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['health', 'strength'],
    minVersion: 'Размяться одну минуту — шея и плечи.',
  },
  {
    title: 'Молитва / медитация',
    icon: '🙏',
    description: 'Осознанная духовная практика — глубже, чем быстрый сброс тревоги дыханием.',
    kind: 'timed',
    recurrence: 'FREQ=DAILY',
    ladder: { minTarget: 1, currentTarget: 5, goalTarget: 20, step: 1, policy: 'adaptive', easyStreak: 0, missStreak: 0 },
    attributes: ['spirit'],
    minVersion: 'Минута тишины с собой или короткая молитва.',
  },
];

import type { GoalDirection } from '../interfaces/goal-full.interface';

/** Шаблон стартовой цели (без `accountId`/`isStarter` — подставляются при севе). */
export interface StarterGoal {
  /** Название (можно с эмодзи). */
  title: string;
  /** Род цели. */
  direction: GoalDirection;
  /** Единица измерения. */
  unit: string;
  /** Целевое значение. */
  targetValue: number;
  /** Базовый замер (для reach/reduce). */
  startValue: number | null;
  /** Зачем это важно (мотив-якорь). */
  whyItMatters: string | null;
  /** Ключи RPG-атрибутов. */
  attributes: string[];
  /** Версия на плохой день. */
  fallbackVersion: string | null;
}

/**
 * Стартовый набор целей — по кнопке «Получить пак» (`POST /accent/goals/starter-pack`),
 * идемпотентно (дедуп по названию, только докидывает). Сеются как **примеры**
 * (`is_starter=true`, ADR-0051 «инертная витрина»): видны в списке с бейджем, но не считаются
 * «в работе» (нет в дашборде) и не принимают записи до присвоения («Добавить себе»/«Изм.»).
 *
 * Балансом покрыты **все три рода** (накопить / достичь уровня / снизить) и сферы (тело, ум,
 * язык, дух, деньги, отказ), чтобы новичок **увидел на примере, какие бывают цели** и выбрал
 * близкое. У каждой — `fallbackVersion` (минимум на плохой день, anti-burnout). Без дедлайнов
 * (срок — личный). Числа reduce/reach — плейсхолдеры, человек правит под себя при «Добавить себе».
 */
export const STARTER_GOALS: readonly StarterGoal[] = [
  // ── Накопить (accumulate) ──
  {
    title: '📚 Прочитать 24 книги за год',
    direction: 'accumulate',
    unit: 'книг',
    targetValue: 24,
    startValue: null,
    whyItMatters: 'Две книги в месяц — и через год ты другой человек.',
    attributes: ['intellect', 'discipline'],
    fallbackVersion: 'Прочитать сегодня хотя бы 5 страниц.',
  },
  {
    title: '🏃 Пробежать 200 км',
    direction: 'accumulate',
    unit: 'км',
    targetValue: 200,
    startValue: null,
    whyItMatters: 'Маленькие пробежки складываются в большую дистанцию.',
    attributes: ['health', 'discipline'],
    fallbackVersion: 'Выйти и пройти/пробежать 1 км.',
  },
  {
    title: '💪 1000 отжиманий суммарно',
    direction: 'accumulate',
    unit: 'раз',
    targetValue: 1000,
    startValue: null,
    whyItMatters: 'Сила копится по чуть-чуть, каждый день.',
    attributes: ['strength', 'discipline'],
    fallbackVersion: 'Сделать 10 отжиманий.',
  },
  {
    title: '💰 Отложить 100 000',
    direction: 'accumulate',
    unit: '₽',
    targetValue: 100000,
    startValue: null,
    whyItMatters: 'Подушка безопасности — это спокойствие.',
    attributes: ['discipline'],
    fallbackVersion: 'Отложить сегодня хотя бы 100 ₽.',
  },
  {
    title: '🧘 50 часов тишины/медитации',
    direction: 'accumulate',
    unit: 'ч',
    targetValue: 50,
    startValue: null,
    whyItMatters: 'Регулярная тишина перестраивает отношение к себе.',
    attributes: ['spirit', 'health'],
    fallbackVersion: '5 минут тишины с собой.',
  },
  {
    title: '✍️ Написать 30 000 слов',
    direction: 'accumulate',
    unit: 'слов',
    targetValue: 30000,
    startValue: null,
    whyItMatters: 'Книга/проект пишется по одному предложению.',
    attributes: ['intellect', 'discipline'],
    fallbackVersion: 'Написать одно предложение.',
  },
  {
    title: '🗣 Выучить 1000 слов языка',
    direction: 'accumulate',
    unit: 'слов',
    targetValue: 1000,
    startValue: null,
    whyItMatters: 'Язык открывает людей и мир.',
    attributes: ['intellect'],
    fallbackVersion: 'Выучить 5 новых слов.',
  },
  {
    title: '🎨 Сделать 100 работ',
    direction: 'accumulate',
    unit: 'шт',
    targetValue: 100,
    startValue: null,
    whyItMatters: 'Мастерство приходит через количество.',
    attributes: ['spirit', 'intellect'],
    fallbackVersion: 'Один набросок/эскиз.',
  },
  {
    title: '🤝 50 добрых дел',
    direction: 'accumulate',
    unit: 'шт',
    targetValue: 50,
    startValue: null,
    whyItMatters: 'Доброта — мышца, которую стоит качать.',
    attributes: ['social', 'spirit'],
    fallbackVersion: 'Сказать кому-то спасибо от души.',
  },
  // ── Достичь уровня (reach) ──
  {
    title: '🏋️ Выйти на 20 подтягиваний',
    direction: 'reach',
    unit: 'раз',
    targetValue: 20,
    startValue: 5,
    whyItMatters: 'Контроль над своим телом.',
    attributes: ['strength', 'discipline'],
    fallbackVersion: 'Один вис/подтягивание.',
  },
  {
    title: '🏃 Пробегать 10 км без остановки',
    direction: 'reach',
    unit: 'км',
    targetValue: 10,
    startValue: 2,
    whyItMatters: 'Выносливость меняет самочувствие во всём.',
    attributes: ['health'],
    fallbackVersion: 'Пробежать 500 метров.',
  },
  {
    title: '💤 Спать 8 часов',
    direction: 'reach',
    unit: 'ч',
    targetValue: 8,
    startValue: 6,
    whyItMatters: 'Сон — фундамент всего остального.',
    attributes: ['health', 'discipline'],
    fallbackVersion: 'Лечь на 15 минут раньше.',
  },
  {
    title: '🧎 Дотянуться до пола ладонями',
    direction: 'reach',
    unit: 'см до пола',
    targetValue: 0,
    startValue: 20,
    whyItMatters: 'Гибкость — это свобода движения и меньше боли.',
    attributes: ['health'],
    fallbackVersion: 'Потянуться 30 секунд.',
  },
  // ── Снизить (reduce) — ядро «тренажёра отказа» ──
  {
    title: '🚭 Бросить курить',
    direction: 'reduce',
    unit: 'сиг/день',
    targetValue: 0,
    startValue: 20,
    whyItMatters: 'Отказ — главная мышца; здесь — ради лёгких и лет жизни.',
    attributes: ['discipline', 'health'],
    fallbackVersion: 'Сегодня — на одну сигарету меньше.',
  },
  {
    title: '🍷 Снизить алкоголь',
    direction: 'reduce',
    unit: 'порций/нед',
    targetValue: 0,
    startValue: 7,
    whyItMatters: 'Трезвость — это ясная голова и подарок завтрашнему себе.',
    attributes: ['discipline', 'health'],
    fallbackVersion: 'Один трезвый день.',
  },
  {
    title: '📱 Снизить экранное время',
    direction: 'reduce',
    unit: 'ч/день',
    targetValue: 2,
    startValue: 6,
    whyItMatters: 'Время без ленты — тренировка отказа от лишнего.',
    attributes: ['discipline', 'spirit'],
    fallbackVersion: 'Сегодня на 15 минут меньше ленты.',
  },
  {
    title: '⚖️ Снизить вес',
    direction: 'reduce',
    unit: 'кг',
    targetValue: 70,
    startValue: 85,
    whyItMatters: 'Не про цифру, а про энергию и здоровье. Числа поправь под себя.',
    attributes: ['health', 'discipline'],
    fallbackVersion: 'Одна прогулка или один овощ вместо снека.',
  },
  {
    title: '🍬 Снизить сахар',
    direction: 'reduce',
    unit: 'ложек/день',
    targetValue: 0,
    startValue: 6,
    whyItMatters: 'Меньше сахара — ровнее энергия и настроение.',
    attributes: ['discipline', 'health'],
    fallbackVersion: 'Сегодня на одну ложку меньше.',
  },
];

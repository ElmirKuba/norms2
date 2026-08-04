// Зеркало контрактов раздела «Акцент» (`/api/v1/accent/*`).

/** Настройки раздела (`GET /accent/settings`). `overallStreakThreshold` добавится в 2.8. */
export interface AccentSettingsView {
  /** Момент начала паузы-режима (ISO) или null (не на паузе). */
  accentPausedFrom: string | null;
}

/** Категория микро-победы (зеркало бэка). */
export type MicroWinCategory =
  | 'physical'
  | 'mental'
  | 'emotional'
  | 'social'
  | 'sensory'
  | 'household'
  | 'digital'
  | 'rest'
  | 'spiritual'
  | 'nature'
  | 'boundaries';

/** Состояние пользователя (значения `disabledForStates`; зеркало бэка). */
export type AccentUserState =
  | 'survival'
  | 'recovery'
  | 'stability'
  | 'growth'
  | 'sprint'
  | 'maintenance';

/** Микро-победа наружу (`GET /accent/micro-wins`). `completedToday` — выполнена ли сегодня. */
/** Ответ «сделал минимум»: задача после зачёта + был ли лог микро-победы первым за день. */
export interface CompleteMinimumResult {
  /** Задача после зачёта (статус `partial`, значение = `minTarget`). */
  task: TaskView;
  /** `true`, если микро-победа отмечена впервые сегодня. */
  microWinNewlyCompleted: boolean;
}

/** Минимум на плохой день, прицепленный к задаче (2.7·H). */
export interface TaskMinAction {
  /** Идентификатор микро-победы. */
  microWinId: string;
  /** Название — идёт прямо в подпись кнопки. */
  title: string;
  /** Длительность действия (сек) — для таймера. */
  durationSeconds: number;
  /** Подготовка перед действием (сек) или null. */
  prepSeconds: number | null;
}

export interface MicroWinView {
  /** Идентификатор. */
  id: string;
  /** Название действия. */
  title: string;
  /** Категория нагрузки (ось модальности «какой сброс»). */
  category: MicroWinCategory;
  /** Сфера жизни (мягкий ключ, опц.; ось «какую сферу питает», M#B3-1) или null. */
  domainKey: string | null;
  /** Длительность действия в секундах. */
  durationSeconds: number;
  /** Время на подготовку в секундах (опц., M#B3-4) или null = без подготовки. */
  prepSeconds: number | null;
  /** Цена энергии 1..3. */
  energyCost: number;
  /** Ожидаемый эффект или null. */
  effect: string | null;
  /** Состояния, в которых скрывать, или null. */
  disabledForStates: AccentUserState[] | null;
  /** Выполнена ли сегодня (дневной фидбэк). */
  completedToday: boolean;
  /** Стартовая (пример из пака), ещё не присвоена — для badge «пример» (2.3). */
  isStarter: boolean;
}

/** Тело создания/обновления микро-победы (`POST`/`PATCH /accent/micro-wins`). */
export interface MicroWinPayload {
  /** Название действия. */
  title: string;
  /** Категория нагрузки (ось модальности). */
  category: MicroWinCategory;
  /** Сфера жизни (мягкий ключ, опц.; ось M#B3-1). */
  domainKey?: string | null;
  /** Длительность действия в секундах (0..300). */
  durationSeconds: number;
  /** Время на подготовку в секундах (опц., 0..300, M#B3-4); null = без подготовки. */
  prepSeconds?: number | null;
  /** Цена энергии 1..3. */
  energyCost: number;
  /** Ожидаемый эффект (опц.). */
  effect?: string | null;
}

/** RU-подписи категорий микро-побед (для select и карточек). */
export const MICRO_WIN_CATEGORY_LABELS: Readonly<Record<MicroWinCategory, string>> = {
  physical: '🫀 Телесное',
  mental: '🧠 Ум',
  emotional: '❤️ Эмоции',
  social: '👋 Общение',
  sensory: '👁 Сенсорика',
  household: '🧹 Быт',
  digital: '📵 Цифровое',
  rest: '😴 Отдых',
  spiritual: '🧘 Тишина / смысл',
  nature: '🌿 Природа',
  boundaries: '🛡 Границы',
};

/** Короткие пояснения «что/зачем» по категориям (для подсказки в форме и легенды на странице). */
export const MICRO_WIN_CATEGORY_DESCRIPTIONS: Readonly<Record<MicroWinCategory, string>> = {
  physical: 'Тело и движение — будит, сбивает оцепенение',
  mental: 'Голова и фокус — мягко включает мышление',
  emotional: 'Чувства — возвращает контакт с собой',
  social: 'Связь с людьми — вытаскивает из изоляции',
  sensory: 'Органы чувств — возвращает в «здесь и сейчас»',
  household: 'Среда вокруг — порядок снаружи = внутри',
  digital: 'Гигиена внимания — против залипания в ленте',
  rest: 'Отдых — разрешить паузу тоже победа',
  spiritual: 'Тишина и смысл — пауза, благодарность, «зачем» (это вид действия, не сфера жизни)',
  nature: 'Природа — свет, воздух, небо',
  boundaries: 'Сказать «нет» лишнему — сберечь силы и время',
};

/** Элемент справочника (сфера/атрибут): ключ + название (`GET /accent/domains|attributes`). */
export interface AccentRefItem {
  /** Slug-ключ. */
  key: string;
  /** Отображаемое название. */
  title: string;
}

// ── Привычки + задачи (2.4; зеркало бэка) ──

/** Тип привычки/задачи: бинарная / счётная / по времени. */
export type HabitKind = 'binary' | 'quantitative' | 'timed' | 'clock';

/** Политика лесенки. */
export type LadderPolicy = 'manual' | 'adaptive';

/** Полярность лесенки (ADR-0058): `raise` — выше лучше; `lower` — ниже/раньше лучше. */
export type LadderDirection = 'raise' | 'lower';

/** RU-подписи типов привычек. */
export const HABIT_KIND_LABELS: Readonly<Record<HabitKind, string>> = {
  binary: 'Да/нет',
  quantitative: 'Счётная',
  timed: 'По времени',
  clock: 'Время суток',
};

/** Пояснения «что это» по типам привычек (для подсказок и гида). */
export const HABIT_KIND_DESCRIPTIONS: Readonly<Record<HabitKind, string>> = {
  binary: 'Просто «сделал или нет», галочка. Напр. «сделать зарядку».',
  quantitative: 'Считаем количество — раз/штук. Напр. «10 отжиманий», «3 страницы».',
  timed: 'Считаем время — минуты/секунды. Напр. «10 минут медитации».',
  clock: 'Целевое время суток — раньше лучше. Напр. «отбой не позже 2:30», планка сдвигает время раньше.',
};

/** RPG-атрибуты: пояснения «что качает» (для гида; ключи каталога). */
export const ATTRIBUTE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  strength: 'Сила — тело, физическая форма, выносливость',
  discipline: 'Дисциплина — воля, доведение до конца, режим',
  intellect: 'Интеллект — ум, знания, обучение',
  spirit: 'Дух — смысл, спокойствие, благодарность',
  social: 'Социальность — связи, общение, поддержка',
  health: 'Здоровье — самочувствие, сон, восстановление',
};

/** Лесенка наружу (цели + политика; счётчики скрыты на бэке). */
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

/** Привычка наружу (`GET /accent/habits`). */
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
  /** Лесенка. */
  ladder: LadderView;
  /** Текст «минимум плохого дня» или null. */
  minVersion: string | null;
  /** Микро-победа как минимум на плохой день (2.7·H) или null. */
  minVersionMicroWinId: string | null;
  /** Время подготовки (сек) перед timed-таймером или null (FEAT-H1). */
  prepSeconds: number | null;
}

/** Тело создания/обновления привычки (`POST`/`PATCH /accent/habits`). */
export interface HabitPayload {
  /** Название. */
  title: string;
  /** Тип измерения. */
  kind: HabitKind;
  /** Расписание (RRULE). */
  recurrence: string;
  /** Дата старта расписания `YYYY-MM-DD` (опц.; null/не задано → якорь = дата создания). */
  startDate?: string | null;
  /** Лесенка (без счётчиков — их ставит бэк). */
  ladder: {
    minTarget: number;
    currentTarget: number;
    goalTarget?: number | null;
    step?: number | null;
    policy: LadderPolicy;
    direction?: LadderDirection;
    anchorMinutes?: number | null;
  };
  /** Описание (опц.). */
  description?: string | null;
  /** Иконка (опц.). */
  icon?: string | null;
  /** Ключ сферы (опц.). */
  domainKey?: string | null;
  /** Ключи RPG-атрибутов (опц.). */
  attributes?: string[];
  /** Привязка к цели (опц.). */
  goalId?: string | null;
  /** Приоритет (опц.). */
  priority?: number;
  /** Текст «минимум плохого дня» (опц.). */
  minVersion?: string | null;
  /** Микро-победа как минимум на плохой день (2.7·H); null — снять привязку. */
  minVersionMicroWinId?: string | null;
  /** Время подготовки (сек) перед timed-таймером (опц., FEAT-H1). */
  prepSeconds?: number | null;
}

/** Статус задачи. */
export type TaskStatus = 'pending' | 'done' | 'partial' | 'skipped';

/** Причина пропуска. */
export type TaskSkipReason = 'postponed';

/** Задача дня наружу (`GET /accent/tasks`). */
export interface TaskView {
  /** Идентификатор. */
  id: string;
  /** Привычка-шаблон или null (разовая). */
  templateId: string | null;
  /** Привязка к цели или null. */
  goalId: string | null;
  /**
   * Минимум на плохой день (2.7·H) или null. Приходит объектом, а не id: карточке сразу нужны и
   * подпись кнопки, и параметры таймера — без второго запроса за каталогом микро-побед.
   */
  minAction: TaskMinAction | null;
  /** Название. */
  title: string;
  /** Локальная дата дня `YYYY-MM-DD`. */
  occurredOn: string;
  /** Тип измерения. */
  kind: HabitKind;
  /** Целевое значение дня или null. */
  targetValue: number | null;
  /** Сделано (частичное) или null. */
  doneValue: number | null;
  /** Статус. */
  status: TaskStatus;
  /** Причина пропуска или null. */
  skipReason: TaskSkipReason | null;
  /** Приоритет. */
  priority: number;
  /** Категория (для разовых) или null. */
  category: string | null;
  /** Дедлайн (ISO) или null. */
  deadline: string | null;
  /** Момент выполнения (ISO) или null. */
  completedAt: string | null;
  /** Задача всплыла из вчерашнего переноса — для метки «со вчера». */
  carriedFromPostpone: boolean;
}

/**
 * Событие лесенки после выполнения adaptive-привычки: направление + было/стало планки
 * (`currentTarget`) — для конкретного фидбэка «планка 20→30». null — нет движения.
 */
export type LadderEventView = {
  direction: 'raised' | 'lowered';
  prevTarget: number;
  newTarget: number;
} | null;

/** Результат выполнения задачи (`POST /accent/tasks/:id/complete`): задача + событие лесенки. */
export interface CompleteTaskResult {
  /** Обновлённая задача. */
  task: TaskView;
  /** Движение планки (для фидбэка «планка выросла / мягче») или null. */
  ladderEvent: LadderEventView;
}

/** Тело создания разовой задачи (`POST /accent/tasks`). */
export interface OneOffTaskPayload {
  /** Название. */
  title: string;
  /** День `YYYY-MM-DD`. */
  occurredOn: string;
  /** Тип измерения. */
  kind: HabitKind;
  /** Цель (опц.). */
  targetValue?: number | null;
  /** Категория (опц.). */
  category?: string | null;
  /** Дедлайн ISO (опц.). */
  deadline?: string | null;
  /** Приоритет (опц.). */
  priority?: number;
}

// ─────────────────────────── Цели (2.5) ───────────────────────────

/** Род цели — как трактуется значение/прогресс (ADR-0052). */
export type GoalDirection = 'accumulate' | 'reach' | 'reduce' | 'maintain';

/** Статус цели. */
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

/** Прогноз к сроку (цвет UI). */
export type GoalForecast = 'ahead' | 'on_track' | 'behind' | null;

/** Человекочитаемые подписи рода цели. */
export const GOAL_DIRECTION_LABELS: Readonly<Record<GoalDirection, string>> = {
  accumulate: 'Накопить',
  reach: 'Достичь уровня',
  reduce: 'Снизить',
  maintain: 'Удерживать',
};

/** Подсказки рода цели (для формы). */
export const GOAL_DIRECTION_DESCRIPTIONS: Readonly<Record<GoalDirection, string>> = {
  accumulate: 'Копить количество: каждая запись — вклад «+N» (напр. «50 книг»).',
  reach: 'Выйти на уровень: запись — текущий замер (напр. «15 подтягиваний»).',
  reduce: 'Снизить до цели: запись — текущий замер, цель ниже старта (напр. «курить 0»).',
  maintain: 'Держать замер в коридоре: укажи нижнюю и верхнюю границу (напр. «экран 0–1 ч»).',
};

/** Базовая проекция цели (мутации `POST`/`PATCH`/lifecycle возвращают её). */
/** Что дашборд предлагает сделать прямо сейчас (2.11). */
export type DashboardNowKind = 'overdue' | 'task' | 'micro_win' | 'all_done';

/** Герой главного экрана: одно дело и одна кнопка. */
export interface DashboardNow {
  /** Что именно предлагаем. */
  kind: DashboardNowKind;
  /** Название дела или null (для `all_done` дела нет — экран хвалит). */
  title: string | null;
  /** Задача для действия или null. */
  taskId: string | null;
  /** Микро-победа для действия или null. */
  microWinId: string | null;
}

/** Задача дня в короткой сводке. */
export interface DashboardTaskItem {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Статус. */
  status: string;
}

/** Блок «Сегодня». */
export interface DashboardToday {
  /** Сколько задач в дне. */
  total: number;
  /** Сколько закрыто. */
  done: number;
  /** Процент дня. */
  percent: number;
  /** До пяти задач. */
  items: DashboardTaskItem[];
}

/** Цель в сводке. */
export interface DashboardGoalItem {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Процент или null. */
  percentage: number | null;
  /** В фокусе ли. */
  isFocus: boolean;
}

/** «Держусь» в сводке (счётчик тикает на фронте от момента старта). */
export interface DashboardAntiHabitItem {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Момент старта текущей попытки (unix ms). */
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

/** Три шага первого знакомства: все `true` — чек-лист исчезает. */
export interface DashboardOnboarding {
  /** Есть своя привычка. */
  hasHabits: boolean;
  /** Хоть раз что-то отмечал. */
  hasFirstCompletion: boolean;
  /** Есть своя цель. */
  hasGoals: boolean;
}

/**
 * Постоянство (2.9) — два числа, отвечающие на разные вопросы: итог «кто я» (не падает никогда)
 * и окно «как я сейчас» (восстанавливается само). Порознь они врут, поэтому показываются парой.
 */
export interface PersistenceView {
  /** Сколько всего дней с действием. */
  totalDays: number;
  /** Сколько дней с действием в окне последних `windowSize`. */
  windowDays: number;
  /** Размер окна в днях (приходит с бэка — фронт его не знает наизусть). */
  windowSize: number;
  /** Последний день с действием (`YYYY-MM-DD`) или null. */
  lastActiveOn: string | null;
  /** Сколько раз возвращался после долгого перерыва. */
  returnCount: number;
  /** Длина перерыва перед последним возвращением или null. */
  lastReturnSilenceDays: number | null;
  /** Сколько дней тишины идёт сейчас (0 — сегодня уже было действие). */
  silenceDays: number;
}

/** Постоянство по одной привычке. */
export interface HabitPersistenceItem {
  /** Идентификатор привычки. */
  habitId: string;
  /** Название. */
  title: string;
  /** Её постоянство. */
  persistence: PersistenceView;
}

/** Достижение на экране статистики — выданное или ещё нет. */
export interface AchievementItem {
  /** Код из каталога. */
  code: string;
  /** Название. */
  title: string;
  /** Что произошло (для выданного). */
  description: string;
  /** Как получить (для невыданного). */
  hint: string;
  /** Когда выдано (ISO) или null. */
  awardedAt: string | null;
  /** Деталь момента («после 12 дней тишины») или null. */
  context: string | null;
}

/** Снимок экрана статистики (2.9). */
export interface StatsView {
  /** Постоянство по аккаунту. */
  persistence: PersistenceView;
  /** Постоянство по каждой своей привычке. */
  habits: HabitPersistenceItem[];
  /** Весь каталог достижений: выданные — с датой, остальные — с подсказкой. */
  achievements: AchievementItem[];
  /** Сколько выдано. */
  awardedCount: number;
}

/** Снимок главного экрана — всё за один запрос (2.11). */
export interface DashboardView {
  /** Герой экрана. */
  now: DashboardNow;
  /** Блок «Сегодня». */
  today: DashboardToday;
  /** Цели, фокусные первыми. */
  goals: DashboardGoalItem[];
  /** Идущие «держусь». */
  antiHabits: DashboardAntiHabitItem[];
  /** Просроченные разовые задачи. */
  overdue: DashboardOverdueItem[];
  /** Есть ли свои препятствия. */
  hasObstacles: boolean;
  /** Постоянство: итог и окно (вся картина — на `/accent/stats`). */
  persistence: PersistenceView;
  /** Шаги первого знакомства. */
  onboarding: DashboardOnboarding;
  /** Раздел на паузе с (ISO) или null. */
  pausedFrom: string | null;
}

/** Что случилось с привычкой в этот день (история, 2.7.3). */
export type HabitHistoryEvent = 'done' | 'partial' | 'postponed' | 'pending';

/** Движение планки в этот день (факт «было → стало»; механику роста бэк не отдаёт). */
export interface HabitLadderMove {
  /** Планка до этого дня. */
  from: number;
  /** Планка в этот день. */
  to: number;
}

/** Один день истории привычки — обработанный факт, а не сырая строка задачи. */
export interface HabitHistoryDay {
  /** Локальная дата `YYYY-MM-DD`. */
  occurredOn: string;
  /** Что случилось. */
  event: HabitHistoryEvent;
  /** Сколько сделано или null. */
  doneValue: number | null;
  /** Какая была планка в этот день или null. */
  targetValue: number | null;
  /** Момент выполнения (ISO) или null. */
  completedAt: string | null;
  /** Куда перенесли (`YYYY-MM-DD`) — только у `postponed`. */
  postponedTo: string | null;
  /** Сегодняшний день — значит кнопка «В „Сегодня“» имеет смысл. */
  isToday: boolean;
  /** Движение планки или null. */
  ladderMove: HabitLadderMove | null;
}

/** Ответ истории привычки: страница дней + «тишина» (2.7.3). */
export interface HabitHistoryView {
  /** Дни от свежих к старым. */
  items: HabitHistoryDay[];
  /** Курсор «Показать ещё» или null. */
  nextCursor: string | null;
  /** Последняя реальная отметка (`YYYY-MM-DD`) или null. */
  lastMarkedOn: string | null;
  /** Сколько дней с последней отметки или null. */
  daysSinceLastMark: number | null;
}

/** Привязанная микро-победа как «версия цели на плохой день» (2.7.2) — зеркало `TaskMinAction`. */
export interface GoalFallbackAction {
  /** Идентификатор микро-победы. */
  microWinId: string;
  /** Название — идёт в подпись кнопки. */
  title: string;
  /** Длительность действия (сек) — для таймера. */
  durationSeconds: number;
  /** Подготовка перед действием (сек) или null. */
  prepSeconds: number | null;
}

export interface GoalView {
  /** Идентификатор. */
  id: string;
  /** Родительская цель или null (подцель). */
  parentGoalId: string | null;
  /** Название. */
  title: string;
  /** Зачем это важно или null. */
  whyItMatters: string | null;
  /** Ключ сферы или null. */
  domainKey: string | null;
  /** Ключи RPG-атрибутов. */
  attributes: string[];
  /** Род цели. */
  direction: GoalDirection;
  /** Единица измерения. */
  unit: string;
  /** Целевое значение. */
  targetValue: number;
  /** Базовый замер (reach/reduce) или null. */
  startValue: number | null;
  /** Дедлайн `YYYY-MM-DD` или null. */
  deadline: string | null;
  /** Статус. */
  status: GoalStatus;
  /** Когда достигнута (ISO) или null. */
  completedAt: string | null;
  /** Текст «версия на плохой день» или null. */
  fallbackVersion: string | null;
  /**
   * Развёрнутая «версия на плохой день» (2.7.2): всё для кнопки и таймера сразу. Приходит только
   * при чтении ОДНОЙ цели (`GET /accent/goals/:id`); в списках — null.
   */
  fallbackAction?: GoalFallbackAction | null;
  /** Микро-победа как версия цели на плохой день (2.7·H) или null. */
  fallbackMicroWinId: string | null;
  /** «Ради чего откажусь» (mission-filter, ADR-0053) или null. */
  tradeoff: string | null;
  /** Стартовый пример (бейдж «пример»; не в работе/не принимает записи до присвоения, ADR-0051). */
  isStarter: boolean;
  /** Фокус (ADR-0053): null = не в фокусе; не-null = в фокусе + ранг (порядок). */
  focusOrder: number | null;
  /** Начало текущей паузы (ISO) или null. */
  pausedAt: string | null;
}

/** Результат переключения фокуса цели (`POST/DELETE /accent/goals/:id/focus`, ADR-0053). */
export interface GoalFocusResult {
  /** Обновлённая цель. */
  goal: GoalView;
  /** Сколько целей сейчас в фокусе. */
  focusedCount: number;
  /** Мягкий порог (env). */
  softLimit: number;
  /** Превышен ли порог (для мягкого вопроса; не блок). */
  overLimit: boolean;
}

/** Цель с вычисляемым прогрессом (`GET /accent/goals`, `GET /:id`; ADR-0052). */
export interface GoalProgressView extends GoalView {
  /** Текущее значение (или null — rollup/нет данных). */
  currentValue: number | null;
  /** Процент 0..100 или null. */
  percentage: number | null;
  /** Дней до дедлайна (может быть отрицательным) или null. */
  daysLeft: number | null;
  /** Темп — единиц в активный день или null. */
  pace: number | null;
  /** Прогноз к сроку. */
  forecast: GoalForecast;
  /** «При текущем темпе — к этой дате» (`YYYY-MM-DD`) или null. */
  projectedCompletionDate: string | null;
  /** Прогресс посчитан из подцелей (rollup). */
  rollup: boolean;
  /** Число прямых (не архивных) подцелей. */
  subgoalsTotal: number;
  /** Сколько подцелей завершено. */
  subgoalsCompleted: number;
}

/** Тело создания цели (`POST /accent/goals`). */
export interface GoalPayload {
  /** Название. */
  title: string;
  /** Род цели. */
  direction: GoalDirection;
  /** Единица измерения. */
  unit: string;
  /** Целевое значение. */
  targetValue: number;
  /** Родительская цель (опц.) — подцель. */
  parentGoalId?: string | null;
  /** Зачем это важно (опц.). */
  whyItMatters?: string | null;
  /** Ключ сферы (опц.). */
  domainKey?: string | null;
  /** Ключи RPG-атрибутов (опц.). */
  attributes?: string[];
  /** Базовый замер для reach/reduce (опц.). */
  startValue?: number | null;
  /** Дедлайн `YYYY-MM-DD` (опц.). */
  deadline?: string | null;
  /** Текст «версия на плохой день» (опц.). */
  fallbackVersion?: string | null;
  /** Микро-победа как версия цели на плохой день (2.7·H); null — снять привязку. */
  fallbackMicroWinId?: string | null;
  /** «Ради чего откажусь» (mission-filter, для accumulate; опц.). */
  tradeoff?: string | null;
}

/** Тело обновления цели (`PATCH`): `direction`/`startValue`/`parentGoalId` иммутабельны — их нет. */
export interface GoalUpdatePayload {
  title?: string;
  whyItMatters?: string | null;
  domainKey?: string | null;
  attributes?: string[];
  unit?: string;
  targetValue?: number;
  deadline?: string | null;
  fallbackVersion?: string | null;
  fallbackMicroWinId?: string | null;
  tradeoff?: string | null;
}

/** Запись прогресса цели наружу. */
export interface GoalEntryView {
  /** Идентификатор (он же курсор). */
  id: string;
  /** Значение (инкремент/замер). */
  value: number;
  /** Дата `YYYY-MM-DD`. */
  occurredOn: string;
  /** Заметка или null. */
  note: string | null;
  /** Когда создано (ISO). */
  createdAt: string;
}

/** Тело добавления записи прогресса (`POST /accent/goals/:id/entries`). */
export interface GoalEntryPayload {
  /** Значение (инкремент для accumulate / замер для reach/reduce). */
  value: number;
  /** Дата `YYYY-MM-DD` (опц., дефолт — сегодня). */
  occurredOn?: string | null;
  /** Заметка (опц.). */
  note?: string | null;
}

/** Результат добавления записи: запись + цель с пересчитанным прогрессом. */
export interface AddGoalEntryResult {
  /** Созданная запись. */
  entry: GoalEntryView;
  /** Цель с прогрессом (возможно завершённая). */
  goal: GoalProgressView;
}

/** Веха цели наружу (с вычисленным `reached`). */
export interface MilestoneView {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Порог достижения. */
  thresholdValue: number;
  /** Достигнута ли (вычислено). */
  reached: boolean;
}

/** Тело добавления вехи (`POST /accent/goals/:id/milestones`). */
export interface MilestonePayload {
  /** Название. */
  title: string;
  /** Порог достижения. */
  thresholdValue: number;
}

// ─────────────────────────── Держусь / анти-привычки (2.6) ───────────────────────────

/**
 * Анти-привычка «держусь» наружу (`GET /accent/anti-habits`). Серию считает ФРОНТ вживую из
 * `currentAttemptStartedAt` (unix ms); `currentDays` — снимок сервера на момент ответа.
 * `recordDays` — рекорд, переживающий срыв (domain-model §7).
 */
export interface AntiHabitView {
  /** Идентификатор. */
  id: string;
  /** Название (что не делаю / от чего воздерживаюсь). */
  title: string;
  /** Описание или null. */
  description: string | null;
  /** Активна ли. */
  isActive: boolean;
  /** Состояние: `active` (серия идёт) или `planned` (старт в будущем, серия ещё не началась). */
  state: 'active' | 'planned';
  /** Старт текущей попытки (unix ms) — для живого счёта серии; при `planned` — в будущем. */
  currentAttemptStartedAt: number;
  /** Снимок серии в днях на момент ответа (фронт пересчитывает вживую). */
  currentDays: number;
  /** Номер текущей попытки (≥1). */
  attemptNumber: number;
  /** Рекорд серии (дней) — переживает срыв. */
  recordDays: number;
  /** Старт рекордной попытки (unix ms) или null. */
  recordAttemptStartedAt: number | null;
  /** Цель серии в днях или null. */
  targetDays: number | null;
  /** Стартовый пример (`is_starter`, ADR-0051): бейдж «пример», инертен до «Добавить себе». */
  isStarter: boolean;
  /** Следующий порог авто-цели (ADR-0060): ярлык + номинал дней + целевая ДАТА (unix ms). */
  nextGoal: { label: string; thresholdDays: number; targetDate: number };
  /** Когда создано (ISO). */
  createdAt: string;
}

/** Тело создания анти-привычки (`POST /accent/anti-habits`). */
export interface AntiHabitPayload {
  /** Название. */
  title: string;
  /** Описание (опц.). */
  description?: string | null;
  /** Цель серии в днях (опц.). */
  targetDays?: number | null;
  /**
   * Своё время старта (unix ms, опц.) — «Указать своё время старта». Прошлое → серия уже идёт
   * (перенос с другого приложения); будущее → плановый старт (статус «запланировано»).
   */
  startAt?: number | null;
}

/** Тело переноса старта в будущее (`POST /accent/anti-habits/:id/reschedule`). */
export interface ReschedulePayload {
  /** Новый старт (unix ms, в будущем). */
  startAt: number;
}

/** Тело обновления анти-привычки (`PATCH /accent/anti-habits/:id`; все поля опц.). */
export interface AntiHabitUpdatePayload {
  /** Название. */
  title?: string;
  /** Описание. */
  description?: string | null;
  /** Цель серии в днях. */
  targetDays?: number | null;
  /** Активность (`false` = убрать из списка). */
  isActive?: boolean;
}

/** Тип события таймлайна «держусь» (ADR-0059; зеркало бэка). */
export type AntiHabitEventType = 'relapse' | 'reschedule' | 'plan' | 'goal_reached';

/** Событие таймлайна «держусь» наружу (`GET …/events`). Типо-специфичные поля = null вне типа. */
export interface AntiHabitEventView {
  /** Идентификатор. */
  id: string;
  /** Тип события. */
  type: AntiHabitEventType;
  /** Когда произошло (unix ms). */
  occurredAt: number;
  /** relapse/reschedule: длительность завершившейся попытки (мс) или null. */
  attemptDurationMs: number | null;
  /** relapse: номер завершившейся попытки или null. */
  endedAttemptNumber: number | null;
  /** relapse: триггер или null. */
  triggerTag: string | null;
  /** relapse: заметка или null. */
  note: string | null;
  /** relapse: препятствие, из-за которого сорвался, или null (2.7). */
  obstacleId: string | null;
  /** reschedule: прежний старт (unix ms) или null. */
  fromStartedAt: number | null;
  /** reschedule/plan: новый (будущий) старт (unix ms) или null. */
  toStartedAt: number | null;
  /** reschedule: сколько продержался (дней) или null. */
  heldDays: number | null;
  /** goal_reached: ярлык порога или null. */
  thresholdLabel: string | null;
  /** goal_reached: номинал порога (дней) или null. */
  thresholdDays: number | null;
}

/** Тело срыва (`POST /accent/anti-habits/:id/relapse`). Оба поля свободные (без ПДн). */
export interface RelapsePayload {
  /** Препятствие, из-за которого сорвался (опц., 2.7): выбор из своего списка. */
  obstacleId?: string | null;
  /** Триггер (опц.). */
  triggerTag?: string | null;
  /** Заметка (опц.). */
  note?: string | null;
}

/** Результат срыва/переноса: обновлённая анти-привычка + записанное событие. */
export interface RelapseResult {
  /** Анти-привычка после сброса/переноса. */
  antiHabit: AntiHabitView;
  /** Записанное событие таймлайна. */
  event: AntiHabitEventView;
}

/** Страница истории событий (cursor-пагинация). */
export interface AntiHabitEventPage {
  /** События (новые→старые). */
  items: AntiHabitEventView[];
  /** Курсор следующей страницы или null. */
  nextCursor: string | null;
}

// ─────────────────────────── Препятствия (2.7, ADR-0062) ───────────────────────────

/** Виды препятствий — ось «природа проблемы» (обязательна; по ней подбирает Recommender 2.8). */
export const OBSTACLE_TYPES = [
  'inner_critic',
  'avoidance',
  'distraction',
  'body',
  'emotion',
  'people',
  'environment',
  'perfectionism',
] as const;

/** Вид препятствия. */
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

/** Исход столкновения. `null` = «не отмечено», а НЕ «не помогло». */
export type EncounterOutcome = 'helped' | 'partly' | 'no';

/** Препятствие (ответ `GET /accent/obstacles`). */
export interface ObstacleView {
  /** Идентификатор. */
  id: string;
  /** Название («Думскролл»). */
  name: string;
  /** Вид препятствия. */
  type: ObstacleType;
  /** Сфера жизни (мягкий ключ) или null. */
  domainKey: string | null;
  /** Повод, по которому приходит, или null. */
  trigger: string | null;
  /** Признаки, по которым узнаёшь, или null. */
  symptoms: string | null;
  /** Насколько давит 1..5 — самооценка на сегодня. */
  intensity: number;
  /** Активно ли (`false` = в архиве). */
  isActive: boolean;
  /** Пример-витрина (ADR-0051): бейдж «пример», инертен до «Добавить себе». */
  isStarter: boolean;
  /** Ручной порядок (drag). */
  position: number;
  /** Сколько заготовлено ответов (вычисляется на сервере при чтении). */
  counterplaysCount: number;
  /** Сколько раз мешал за 30 дней — информация для приоритета, не счётчик позора. */
  encountersLast30: number;
  /** Когда создано (ISO). */
  createdAt: string;
}

/** Список препятствий: обёртка нужна из-за флага порога — он про весь список, не про карточку. */
export interface ObstacleListView {
  /** Препятствия в ручном порядке. */
  items: ObstacleView[];
  /** Активных больше мягкого порога → показать подсказку «может, часть в архив?». Не запрет. */
  softLimitExceeded: boolean;
}

/** Тело создания препятствия (`POST /accent/obstacles`). */
export interface ObstaclePayload {
  /** Название. */
  name: string;
  /** Вид (обязателен). */
  type: ObstacleType;
  /** Сфера жизни (опц.). */
  domainKey?: string | null;
  /** Повод (опц.). */
  trigger?: string | null;
  /** Признаки (опц.). */
  symptoms?: string | null;
  /** Насколько давит 1..5 (опц., дефолт 3). */
  intensity?: number;
}

/** Тело правки препятствия (все поля опц.; `isActive:false` = в архив). */
export interface ObstacleUpdatePayload {
  name?: string;
  type?: ObstacleType;
  domainKey?: string | null;
  trigger?: string | null;
  symptoms?: string | null;
  intensity?: number;
  isActive?: boolean;
}

/** Контрмера — свой готовый ответ на препятствие. */
export interface CounterplayView {
  /** Идентификатор. */
  id: string;
  /** Препятствие-родитель. */
  obstacleId: string;
  /** Что делаю. */
  text: string;
  /** Привязанная микро-победа (в момент столкновения запускает её таймер) или null. */
  linkedMicroWinId: string | null;
  /** Ручной порядок. */
  position: number;
  /** Сколько раз отмечено «помогло». */
  helpedCount: number;
  /** Сколько применений получили оценку («помогало helpedCount из ratedCount»). */
  ratedCount: number;
  /** Когда создано (ISO). */
  createdAt: string;
}

/** Тело создания контрмеры. */
export interface CounterplayPayload {
  /** Что делаю. */
  text: string;
  /** Привязка к микро-победе (опц.). */
  linkedMicroWinId?: string | null;
}

/** Тело правки контрмеры (`linkedMicroWinId: null` — снять привязку). */
export interface CounterplayUpdatePayload {
  text?: string;
  linkedMicroWinId?: string | null;
}

/** Запись столкновения. */
export interface ObstacleEncounterView {
  /** Идентификатор. */
  id: string;
  /** Препятствие. */
  obstacleId: string;
  /** Когда произошло (unix ms). */
  occurredAt: number;
  /** Чем ответил или null («просто отметил»). */
  counterplayId: string | null;
  /** Исход или null («не отмечено» — не считается негативом). */
  outcome: EncounterOutcome | null;
  /** Заметка или null. */
  note: string | null;
}

/** Тело записи столкновения — всё опционально (помощь за один тап, а не анкета). */
export interface EncounterPayload {
  /** Чем ответил (опц.). */
  counterplayId?: string | null;
  /** Исход (опц., можно позже). */
  outcome?: EncounterOutcome | null;
  /** Заметка (опц.). */
  note?: string | null;
  /** Момент (unix ms, опц.) — допускается отметка задним числом. */
  occurredAt?: number | null;
}

/** Ответ «Столкнулся»: запись + карточка со свежими счётчиками (без второго запроса). */
export interface EncounterRecordResult {
  /** Записанное столкновение. */
  encounter: ObstacleEncounterView;
  /** Препятствие с пересчитанными агрегатами. */
  obstacle: ObstacleView;
}

/** Страница ленты столкновений (keyset-пагинация). */
export interface ObstacleEncounterPage {
  /** Записи страницы (новые→старые). */
  items: ObstacleEncounterView[];
  /** Курсор следующей страницы или null. */
  nextCursor: string | null;
}

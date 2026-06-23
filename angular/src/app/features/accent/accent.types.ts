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
export interface MicroWinView {
  /** Идентификатор. */
  id: string;
  /** Название действия. */
  title: string;
  /** Категория нагрузки. */
  category: MicroWinCategory;
  /** Длительность в секундах. */
  durationSeconds: number;
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
  /** Категория нагрузки. */
  category: MicroWinCategory;
  /** Длительность в секундах (0..300). */
  durationSeconds: number;
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
  spiritual: '🌱 Дух / смысл',
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
  spiritual: 'Дух и смысл — благодарность, «зачем»',
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
export type HabitKind = 'binary' | 'quantitative' | 'timed';

/** Политика лесенки. */
export type LadderPolicy = 'manual' | 'adaptive';

/** RU-подписи типов привычек. */
export const HABIT_KIND_LABELS: Readonly<Record<HabitKind, string>> = {
  binary: 'Да/нет',
  quantitative: 'Счётная',
  timed: 'По времени',
};

/** Пояснения «что это» по типам привычек (для подсказок и гида). */
export const HABIT_KIND_DESCRIPTIONS: Readonly<Record<HabitKind, string>> = {
  binary: 'Просто «сделал или нет», галочка. Напр. «сделать зарядку».',
  quantitative: 'Считаем количество — раз/штук. Напр. «10 отжиманий», «3 страницы».',
  timed: 'Считаем время — минуты/секунды. Напр. «10 минут медитации».',
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
  /** Активна ли. */
  isActive: boolean;
  /** Стартовый пример (бейдж «пример»; не материализует задачи до присвоения). */
  isStarter: boolean;
  /** Лесенка. */
  ladder: LadderView;
  /** Текст «минимум плохого дня» или null. */
  minVersion: string | null;
}

/** Тело создания/обновления привычки (`POST`/`PATCH /accent/habits`). */
export interface HabitPayload {
  /** Название. */
  title: string;
  /** Тип измерения. */
  kind: HabitKind;
  /** Расписание (RRULE). */
  recurrence: string;
  /** Лесенка (без счётчиков — их ставит бэк). */
  ladder: {
    minTarget: number;
    currentTarget: number;
    goalTarget?: number | null;
    step?: number | null;
    policy: LadderPolicy;
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
}

/** Статус задачи. */
export type TaskStatus = 'pending' | 'done' | 'partial' | 'skipped';

/** Причина пропуска. */
export type TaskSkipReason = 'postponed' | 'cancelled';

/** Задача дня наружу (`GET /accent/tasks`). */
export interface TaskView {
  /** Идентификатор. */
  id: string;
  /** Привычка-шаблон или null (разовая). */
  templateId: string | null;
  /** Привязка к цели или null. */
  goalId: string | null;
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
}

/** Событие лесенки после выполнения adaptive-привычки: подъём/откат планки или null. */
export type LadderEventView = 'raised' | 'lowered' | null;

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
export type GoalDirection = 'accumulate' | 'reach' | 'reduce';

/** Статус цели. */
export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived';

/** Прогноз к сроку (цвет UI). */
export type GoalForecast = 'ahead' | 'on_track' | 'behind' | null;

/** Человекочитаемые подписи рода цели. */
export const GOAL_DIRECTION_LABELS: Readonly<Record<GoalDirection, string>> = {
  accumulate: 'Накопить',
  reach: 'Достичь уровня',
  reduce: 'Снизить',
};

/** Подсказки рода цели (для формы). */
export const GOAL_DIRECTION_DESCRIPTIONS: Readonly<Record<GoalDirection, string>> = {
  accumulate: 'Копить количество: каждая запись — вклад «+N» (напр. «50 книг»).',
  reach: 'Выйти на уровень: запись — текущий замер (напр. «15 подтягиваний»).',
  reduce: 'Снизить до цели: запись — текущий замер, цель ниже старта (напр. «курить 0»).',
};

/** Базовая проекция цели (мутации `POST`/`PATCH`/lifecycle возвращают её). */
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
  /** Стартовый пример (бейдж «пример»; не в работе/не принимает записи до присвоения, ADR-0051). */
  isStarter: boolean;
  /** Начало текущей паузы (ISO) или null. */
  pausedAt: string | null;
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

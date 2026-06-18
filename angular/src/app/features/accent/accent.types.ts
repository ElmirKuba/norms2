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

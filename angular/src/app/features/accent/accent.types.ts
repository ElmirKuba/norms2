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
  | 'household';

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
  physical: 'Телесное',
  mental: 'Ум',
  emotional: 'Эмоции',
  social: 'Общение',
  sensory: 'Сенсорика',
  household: 'Быт',
};

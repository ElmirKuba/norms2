/**
 * Категория микро-победы — тип телесно-психической нагрузки (для подбора по состоянию
 * и баланса). Хранится строкой-ключом (varchar), как и `DomainKey`/`Attribute`.
 */
export type MicroWinCategory =
  | 'physical'
  | 'mental'
  | 'emotional'
  | 'social'
  | 'sensory'
  | 'household';

/**
 * UserState — состояние пользователя (выводится `StateResolver` из CheckIn + активности,
 * НЕ хранится как «правда»; domain-model §2). Здесь используется только как значения
 * `disabledForStates` (в каких состояниях скрывать микро-победу).
 * TODO: Claude Code: 2026-06-16: при появлении StateResolver (подфаза 2.7) перенести
 * канонический `UserState` в общий accent-модуль и импортировать его здесь.
 */
export type UserState =
  | 'survival'
  | 'recovery'
  | 'stability'
  | 'growth'
  | 'sprint'
  | 'maintenance';

/**
 * MicroWinFull — микро-победа (быстрое действие 10 сек–5 мин, доступное даже в плохой
 * день; колонки 1:1 со схемой, ADR-0033). Per-account сущность (`accountId` FK).
 * Инварианты (`durationSeconds` ≤300, `energyCost` 1..3) — на domain-service (2.2·2).
 */
export interface MicroWinFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Короткое название действия («1 отжимание», «выпить воды»). */
  title: string;
  /** Категория нагрузки. */
  category: MicroWinCategory;
  /** Длительность в секундах (≤ ~300). */
  durationSeconds: number;
  /** Цена энергии 1..3 (для подбора в survival/recovery). */
  energyCost: number;
  /** Ожидаемый эффект (опц., свободный текст). */
  effect: string | null;
  /** В каких состояниях скрывать (опц.); null = показывать всегда. */
  disabledForStates: UserState[] | null;
  /** Активна ли (мягкое отключение из выдачи). */
  isActive: boolean;
  /** Когда создано. */
  createdAt: Date;
  /** Когда изменено. */
  updatedAt: Date;
}

import type { AntiHabitFull } from '../interfaces/anti-habit-full.interface';

/** DI-токен порта репозитория анти-привычек (биндится в anti-habits.module). */
export const ACCENT_ANTI_HABIT_REPOSITORY = Symbol('ACCENT_ANTI_HABIT_REPOSITORY');

/** Данные создания анти-привычки (id/таймстампы/счётчики проставляет репозиторий). */
export interface AntiHabitCreateData {
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Название. */
  title: string;
  /** Описание (опц.). */
  description?: string | null;
  /** Цель серии в днях (опц.). */
  targetDays?: number | null;
  /** Старт первой попытки (unix ms) — ставит домен (now); attemptNumber=1, recordDays=0. */
  currentAttemptStartedAt: number;
  /** Стартовый пример (ADR-0051): `true` при севе пака; обычное создание — не задаёт (false). */
  isStarter?: boolean;
}

/** Частичный патч анти-привычки (только переданные поля; поля `| undefined` под zod `.partial()`). */
export interface AntiHabitUpdateData {
  title?: string | undefined;
  description?: string | null | undefined;
  targetDays?: number | null | undefined;
  isActive?: boolean | undefined;
  // Внутренние поля (adoption/сброс попытки при присвоении примера, ADR-0051) — НЕ из API-DTO.
  /** Снятие флага «пример» (adoption). */
  isStarter?: boolean | undefined;
  /** Сброс старта попытки при присвоении (unix ms = now). */
  currentAttemptStartedAt?: number | undefined;
  /** Сброс номера попытки при присвоении (→ 1). */
  attemptNumber?: number | undefined;
  /** Сброс рекорда при присвоении (→ 0). */
  recordDays?: number | undefined;
  /** Сброс старта рекордной попытки при присвоении (→ null). */
  recordAttemptStartedAt?: number | null | undefined;
}

/**
 * Мутация `anti_habits` при рецидиве — пишется атомарно под CAS по `version` (ADR-0035):
 * рестарт текущей попытки + инкремент номера + возможное обновление рекорда.
 */
export interface AntiHabitAttemptCas {
  /** Новый старт попытки (unix ms) = момент рецидива. */
  currentAttemptStartedAt: number;
  /** Новый номер попытки (прежний + 1). */
  attemptNumber: number;
  /** Рекорд серии (max от прежнего и завершившейся серии). */
  recordDays: number;
  /** Старт рекордной попытки (unix ms) или прежнее значение. */
  recordAttemptStartedAt: number | null;
}

/**
 * Порт репозитория анти-привычек (per-account), БЕЗ ORM. Все операции скоупятся по
 * `accountId` (владение). Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentAntiHabitRepositoryPort {
  /**
   * Активные анти-привычки аккаунта (по дате создания, затем id — стабильный порядок).
   * @param accountId Идентификатор аккаунта.
   * @returns Список анти-привычек владельца.
   */
  listByAccount(accountId: string): Promise<AntiHabitFull[]>;

  /**
   * Находит анти-привычку по id с проверкой владения.
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  findOwned(id: string, accountId: string): Promise<AntiHabitFull | null>;

  /**
   * Создаёт анти-привычку (id генерирует репозиторий; attemptNumber=1, recordDays=0).
   * @param data Данные создания.
   * @returns Созданная анти-привычка.
   */
  create(data: AntiHabitCreateData): Promise<AntiHabitFull>;

  /**
   * Массовое создание (для сева стартового пака, ADR-0051): каждая строка — как `create`
   * (id/позиция/счётчики — репозиторием). Пустой список → 0.
   * @param items Данные создания.
   * @returns Число созданных строк.
   */
  createMany(items: readonly AntiHabitCreateData[]): Promise<number>;

  /**
   * Удаляет непринятые примеры (`is_starter=true`) аккаунта; присвоенные не трогает (ADR-0051).
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  deleteStarters(accountId: string): Promise<number>;

  /**
   * Обновляет анти-привычку владельца (частично; deactivate = `{ isActive: false }`).
   * Любой update bump'ает `version`.
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  update(id: string, accountId: string, patch: AntiHabitUpdateData): Promise<AntiHabitFull | null>;

  /**
   * CAS-рестарт попытки при рецидиве (ADR-0035): пишет поля попытки и `version+1` только
   * если текущая `version` совпала с `expectedVersion` (иначе — конкурентный рецидив, retry).
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param expectedVersion Ожидаемая версия.
   * @param patch Новые значения попытки/рекорда.
   * @returns true если записано, false при конфликте версий (нужен refetch+retry).
   */
  setAttemptCas(
    id: string,
    accountId: string,
    expectedVersion: number,
    patch: AntiHabitAttemptCas,
  ): Promise<boolean>;

  /**
   * Ручная сортировка (ADR-0054): пишет `position = индекс` для своих id (верх → меньший).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок (сверху вниз).
   */
  reorder(accountId: string, ids: readonly string[]): Promise<void>;
}

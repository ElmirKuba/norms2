import type {
  HabitFull,
  HabitKind,
  HabitLadder,
} from '../interfaces/habit-full.interface';

/** DI-токен порта репозитория привычек (биндится в habits.module). */
export const ACCENT_HABIT_REPOSITORY = Symbol('ACCENT_HABIT_REPOSITORY');

/** Данные создания привычки (id/таймстампы проставляет репозиторий). */
export interface HabitCreateData {
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Название. */
  title: string;
  /** Тип измерения. */
  kind: HabitKind;
  /** Расписание (RRULE-строка). */
  recurrence: string;
  /** Лесенка (со счётчиками easyStreak/missStreak = 0 на старте — ставит домен). */
  ladder: HabitLadder;
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
  /** Приоритет (опц., дефолт 0). */
  priority?: number;
  /** Текст «минимум плохого дня» (опц.). */
  minVersion?: string | null;
  /** Стартовый пример (опц., дефолт false) — для сева стартового пака. */
  isStarter?: boolean;
}

/** Частичный патч привычки (только переданные поля; поля `| undefined` под zod `.partial()`). */
export interface HabitUpdateData {
  title?: string | undefined;
  description?: string | null | undefined;
  icon?: string | null | undefined;
  domainKey?: string | null | undefined;
  attributes?: string[] | undefined;
  goalId?: string | null | undefined;
  priority?: number | undefined;
  kind?: HabitKind | undefined;
  recurrence?: string | undefined;
  ladder?: HabitLadder | undefined;
  isActive?: boolean | undefined;
  minVersion?: string | null | undefined;
  /** Снятие флага «пример» (adoption) — внутреннее, не из API-DTO. */
  isStarter?: boolean | undefined;
}

/**
 * Порт репозитория привычек (per-account), БЕЗ ORM. Все операции скоупятся по
 * `accountId` (владение). Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentHabitRepositoryPort {
  /**
   * Активные привычки аккаунта (по приоритету, затем дате).
   * @param accountId Идентификатор аккаунта.
   * @returns Список привычек владельца.
   */
  listByAccount(accountId: string): Promise<HabitFull[]>;

  /**
   * Находит привычку по id с проверкой владения.
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  findOwned(id: string, accountId: string): Promise<HabitFull | null>;

  /**
   * Создаёт привычку (id генерирует репозиторий).
   * @param data Данные создания.
   * @returns Созданная привычка.
   */
  create(data: HabitCreateData): Promise<HabitFull>;

  /**
   * Массовая вставка привычек (стартовый набор; id на каждую — `generateId()`).
   * @param items Данные создания.
   * @returns Число вставленных строк.
   */
  createMany(items: readonly HabitCreateData[]): Promise<number>;

  /**
   * Удаляет все непринятые стартовые (`is_starter=true`) привычки аккаунта; свои не трогает.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  deleteStarters(accountId: string): Promise<number>;

  /**
   * Обновляет привычку владельца (частично; deactivate = `{ isActive: false }`).
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  update(id: string, accountId: string, patch: HabitUpdateData): Promise<HabitFull | null>;

  /**
   * CAS-запись лесенки (ADR-0035): пишет `ladder` и `version+1` только если текущая
   * `version` совпала с `expectedVersion`. Для движка лесенки (без потери обновлений).
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param expectedVersion Ожидаемая версия.
   * @param ladder Новая лесенка.
   * @returns true если записано, false при конфликте версий (нужен retry).
   */
  setLadderCas(
    id: string,
    accountId: string,
    expectedVersion: number,
    ladder: HabitLadder,
  ): Promise<boolean>;

  /**
   * Ручная сортировка привычек (ADR-0054): пишет `priority` для своих id (верхний → больший priority).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок (сверху вниз).
   */
  reorder(accountId: string, ids: readonly string[]): Promise<void>;
}

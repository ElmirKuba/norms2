import type {
  GoalDirection,
  GoalFull,
  GoalStatus,
} from '../interfaces/goal-full.interface';

/** DI-токен порта репозитория целей (биндится в goals.module). */
export const ACCENT_GOAL_REPOSITORY = Symbol('ACCENT_GOAL_REPOSITORY');

/** Фильтр выборки целей аккаунта (опционально по статусу и/или сфере). */
export interface GoalListFilters {
  /** Только цели с данным статусом. */
  status?: GoalStatus | undefined;
  /** Только цели данной сферы (`accent_domains.key`). */
  domainKey?: string | undefined;
}

/** Данные создания цели (id/таймстампы проставляет репозиторий). */
export interface GoalCreateData {
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Название. */
  title: string;
  /** Род цели (как считается прогресс). */
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
  /** Дедлайн YYYY-MM-DD (опц.). */
  deadline?: string | null;
  /** Текст «версия на плохой день» (опц.). */
  fallbackVersion?: string | null;
  /** Стартовый пример (опц., дефолт false) — для сева пака. */
  isStarter?: boolean;
}

/** Частичный патч цели (только переданные поля; `| undefined` под zod `.partial()`). */
export interface GoalUpdateData {
  title?: string | undefined;
  whyItMatters?: string | null | undefined;
  domainKey?: string | null | undefined;
  attributes?: string[] | undefined;
  unit?: string | undefined;
  targetValue?: number | undefined;
  deadline?: string | null | undefined;
  fallbackVersion?: string | null | undefined;
  /** Снятие флага «пример» (adoption) — внутреннее, не из API-DTO. */
  isStarter?: boolean | undefined;
}

/**
 * Порт репозитория целей (per-account), БЕЗ ORM. Все операции скоупятся по `accountId`
 * (владение). Реализация — `database/repositories/accent` (Drizzle). **Без CAS/version**
 * — агрегаты вычисляются на чтение (ADR-0052); единственный modify-инвариант
 * (авто-`completed`) и lifecycle-переходы — на ·5/·8 через атомарный conditional-update.
 */
export interface AccentGoalRepositoryPort {
  /**
   * Цели аккаунта (по `created_at`), опц. фильтр по статусу/сфере.
   * @param accountId Идентификатор аккаунта.
   * @param filters Фильтр (статус/сфера).
   * @returns Список целей владельца.
   */
  listByAccount(accountId: string, filters?: GoalListFilters): Promise<GoalFull[]>;

  /**
   * Прямые подцели цели (по `created_at`) — для rollup/инварианта глубины.
   * @param parentGoalId Идентификатор родительской цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Список подцелей.
   */
  listChildren(parentGoalId: string, accountId: string): Promise<GoalFull[]>;

  /**
   * Находит цель по id с проверкой владения.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  findOwned(id: string, accountId: string): Promise<GoalFull | null>;

  /**
   * Создаёт цель (id генерирует репозиторий).
   * @param data Данные создания.
   * @returns Созданная цель.
   */
  create(data: GoalCreateData): Promise<GoalFull>;

  /**
   * Массовая вставка целей (стартовый пак; id на каждую — `generateId()`).
   * @param items Данные создания.
   * @returns Число вставленных строк.
   */
  createMany(items: readonly GoalCreateData[]): Promise<number>;

  /**
   * Удаляет все непринятые стартовые (`is_starter=true`) цели аккаунта; присвоенные не трогает.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  deleteStarters(accountId: string): Promise<number>;

  /**
   * Обновляет цель владельца (частично; last-write-wins, без version).
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  update(id: string, accountId: string, patch: GoalUpdateData): Promise<GoalFull | null>;

  /**
   * Ставит цель на паузу (атомарно, только из `active`): `status='paused'`, `paused_at=now`.
   * Открытая пауза = ненулевой `paused_at`; история пауз не трогается (закрытые периоды
   * дописывает `resume`).
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / не в `active`).
   */
  pause(id: string, accountId: string): Promise<GoalFull | null>;

  /**
   * Снимает паузу (атомарно, только из `paused`): `status='active'`, дописывает закрытый
   * период `{pausedAt: текущий paused_at, resumedAt: now}` в `pause_history`, `paused_at=null`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / не в `paused`).
   */
  resume(id: string, accountId: string): Promise<GoalFull | null>;

  /**
   * Архивирует цель (атомарно, из `active|paused|completed`): `status='archived'`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / уже `archived`).
   */
  archive(id: string, accountId: string): Promise<GoalFull | null>;

  /**
   * Восстанавливает из архива (атомарно, только из `archived`): `status='active'`.
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / не в `archived`).
   */
  restore(id: string, accountId: string): Promise<GoalFull | null>;

  /**
   * Авто-завершение (ADR-0052): атомарно `status='completed'`, `completed_at=now` **только
   * если `completed_at IS NULL`** (идемпотентно — фиксируется один раз; гонок нет, без version).
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая строка или null (нет / не ваша / уже завершена).
   */
  markCompleted(id: string, accountId: string): Promise<GoalFull | null>;
}

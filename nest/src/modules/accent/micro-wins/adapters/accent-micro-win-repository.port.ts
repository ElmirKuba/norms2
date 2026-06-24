import type {
  MicroWinCategory,
  MicroWinFull,
  UserState,
} from '../interfaces/micro-win-full.interface';

/** DI-токен порта репозитория микро-побед (биндится в micro-wins.module). */
export const ACCENT_MICRO_WIN_REPOSITORY = Symbol('ACCENT_MICRO_WIN_REPOSITORY');

/** Данные для создания микро-победы (id/таймстампы/isActive проставляет репозиторий). */
export interface MicroWinCreateData {
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Короткое название действия. */
  title: string;
  /** Категория нагрузки. */
  category: MicroWinCategory;
  /** Длительность в секундах (≤300). */
  durationSeconds: number;
  /** Цена энергии 1..3. */
  energyCost: number;
  /** Ожидаемый эффект (опц.). */
  effect?: string | null;
  /** В каких состояниях скрывать (опц.). */
  disabledForStates?: UserState[] | null;
  /** Стартовая (пример из пака) — опц., дефолт false. */
  isStarter?: boolean;
}

/**
 * Частичный патч микро-победы (только переданные поля; владение проверяет домен).
 * Поля допускают `undefined` (совместимость с zod `.partial()`); domain-service
 * собирает чистый объект только из определённых ключей перед отправкой в репозиторий.
 */
export interface MicroWinUpdateData {
  title?: string | undefined;
  category?: MicroWinCategory | undefined;
  durationSeconds?: number | undefined;
  energyCost?: number | undefined;
  effect?: string | null | undefined;
  disabledForStates?: UserState[] | null | undefined;
  isActive?: boolean | undefined;
  /** Снятие флага «стартовое» (adoption) — внутреннее, не из API-DTO. */
  isStarter?: boolean | undefined;
}

/**
 * Порт репозитория микро-побед (per-account CRUD), БЕЗ ORM. Все операции
 * скоупятся по `accountId` (владение). Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentMicroWinRepositoryPort {
  /**
   * Активные микро-победы аккаунта (по дате создания).
   * @param accountId Идентификатор аккаунта.
   * @returns Список микро-побед владельца.
   */
  listByAccount(accountId: string): Promise<MicroWinFull[]>;

  /**
   * Находит микро-победу по id с проверкой владения.
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null (нет / не ваша).
   */
  findOwned(id: string, accountId: string): Promise<MicroWinFull | null>;

  /**
   * Создаёт микро-победу (id генерирует репозиторий).
   * @param data Данные создания (с `accountId`).
   * @returns Созданная микро-победа.
   */
  create(data: MicroWinCreateData): Promise<MicroWinFull>;

  /**
   * Массовая вставка микро-побед (стартовый набор; id генерирует репозиторий).
   * @param items Данные создания.
   * @returns Число вставленных строк.
   */
  createMany(items: readonly MicroWinCreateData[]): Promise<number>;

  /**
   * Обновляет микро-победу владельца (частично).
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  update(id: string, accountId: string, patch: MicroWinUpdateData): Promise<MicroWinFull | null>;

  /**
   * Удаляет микро-победу владельца (логи каскадятся по FK).
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns true если удалено, false если нет / не ваша.
   */
  remove(id: string, accountId: string): Promise<boolean>;

  /**
   * Удаляет все ещё не присвоенные стартовые победы аккаунта (`is_starter=true`).
   * Свои (присвоенные) НЕ трогает.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  deleteStarters(accountId: string): Promise<number>;

  /**
   * Логирует выполнение микро-победы за день — идемпотентно (ON CONFLICT по
   * `(micro_win_id, occurred_on)` DO NOTHING = дневной лимит).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param microWinId Идентификатор микро-победы.
   * @param occurredOn Локальная дата `YYYY-MM-DD`.
   * @returns true если лог создан впервые, false если уже был сегодня (no-op).
   */
  logCompletion(accountId: string, microWinId: string, occurredOn: string): Promise<boolean>;

  /**
   * Идентификаторы микро-побед, выполненных аккаунтом в указанный день.
   * @param accountId Идентификатор аккаунта.
   * @param occurredOn Локальная дата `YYYY-MM-DD`.
   * @returns Список `microWinId`, по которым есть лог за этот день.
   */
  listLoggedOn(accountId: string, occurredOn: string): Promise<string[]>;

  /**
   * Переставляет микро-победы аккаунта в порядок `ids` (ADR-0054): `position = индекс` для своих id.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок.
   */
  reorder(accountId: string, ids: readonly string[]): Promise<void>;
}

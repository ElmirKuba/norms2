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
}

/** Частичный патч микро-победы (только переданные поля; владение проверяет домен). */
export interface MicroWinUpdateData {
  title?: string;
  category?: MicroWinCategory;
  durationSeconds?: number;
  energyCost?: number;
  effect?: string | null;
  disabledForStates?: UserState[] | null;
  isActive?: boolean;
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
}

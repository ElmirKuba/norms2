import type { ObstacleFull, ObstacleType } from '../interfaces/obstacle-full.interface';

/** DI-токен порта репозитория препятствий (биндится в obstacles.module). */
export const ACCENT_OBSTACLE_REPOSITORY = Symbol('ACCENT_OBSTACLE_REPOSITORY');

/** Данные создания препятствия (id/позицию/таймстампы проставляет репозиторий). */
export interface ObstacleCreateData {
  /** Владелец — FK на `accounts.id`. */
  accountId: string;
  /** Название. */
  name: string;
  /** Вид препятствия (обязателен — по нему подбирает Recommender 2.8). */
  type: ObstacleType;
  /** Сфера жизни (опц., мягкий ключ). */
  domainKey?: string | null;
  /** Повод (опц.). */
  trigger?: string | null;
  /** Признаки (опц.). */
  symptoms?: string | null;
  /** Насколько давит 1..5 (опц.; дефолт 3 — в схеме). */
  intensity?: number;
  /** Стартовый пример (ADR-0051): `true` при севе пака; обычное создание — не задаёт (false). */
  isStarter?: boolean;
}

/** Частичный патч препятствия (только переданные поля; `| undefined` под zod `.partial()`). */
export interface ObstacleUpdateData {
  name?: string | undefined;
  type?: ObstacleType | undefined;
  domainKey?: string | null | undefined;
  trigger?: string | null | undefined;
  symptoms?: string | null | undefined;
  intensity?: number | undefined;
  isActive?: boolean | undefined;
  /** Снятие флага «пример» (adoption, ADR-0051) — внутреннее поле, НЕ из API-DTO. */
  isStarter?: boolean | undefined;
}

/**
 * Порт репозитория препятствий (per-account), БЕЗ ORM. Все операции скоупятся по `accountId`
 * (владение проверяется здесь же, а не только в домене). Реализация — `database/repositories/
 * accent` (Drizzle). Любой `update` bump'ает `version` (конвенция ADR-0035); строгий CAS для
 * препятствий пока не включён — гонок «двух устройств по одной строке» тут не ожидается.
 */
export interface AccentObstacleRepositoryPort {
  /**
   * Препятствия аккаунта в ручном порядке (position, затем created_at, тай-брейкер id).
   * @param accountId Идентификатор аккаунта.
   * @param includeArchived Включать ли архивные (`is_active=false`); по умолчанию нет.
   * @returns Список препятствий владельца.
   */
  listByAccount(accountId: string, includeArchived?: boolean): Promise<ObstacleFull[]>;

  /**
   * Находит препятствие по id с проверкой владения.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Строка или null.
   */
  findOwned(id: string, accountId: string): Promise<ObstacleFull | null>;

  /**
   * Считает активные препятствия аккаунта — для мягкого фокус-лимита (ADR-0062 п.8).
   * @param accountId Идентификатор аккаунта.
   * @returns Число активных.
   */
  countActive(accountId: string): Promise<number>;

  /**
   * Создаёт препятствие (id — `generateId()`, `position` = max+1 в конец списка).
   * @param data Данные создания.
   * @returns Созданное препятствие.
   */
  create(data: ObstacleCreateData): Promise<ObstacleFull>;

  /**
   * Массовое создание (сев стартового пака, ADR-0051): позиции продолжают текущий максимум.
   * @param items Данные создания.
   * @returns Число созданных строк.
   */
  createMany(items: readonly ObstacleCreateData[]): Promise<number>;

  /**
   * Удаляет непринятые примеры (`is_starter=true`) аккаунта; присвоенные не трогает (ADR-0051).
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  deleteStarters(accountId: string): Promise<number>;

  /**
   * Обновляет препятствие владельца (частично; «в архив» = `{ isActive: false }`).
   * Любой update bump'ает `version`.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null (нет / не ваша).
   */
  update(id: string, accountId: string, patch: ObstacleUpdateData): Promise<ObstacleFull | null>;

  /**
   * Полностью удаляет препятствие владельца. Контрмеры и журнал уходят каскадом, ссылки из
   * `anti_habit_events` обнуляются (SET NULL) — история «Держусь» не рушится.
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns true если удалено, false если нет / не ваше.
   */
  delete(id: string, accountId: string): Promise<boolean>;

  /**
   * Ручная сортировка (ADR-0054): пишет `position = индекс` для своих id (верх → меньший).
   * @param accountId Идентификатор аккаунта-владельца.
   * @param ids Желаемый порядок (сверху вниз).
   */
  reorder(accountId: string, ids: readonly string[]): Promise<void>;
}

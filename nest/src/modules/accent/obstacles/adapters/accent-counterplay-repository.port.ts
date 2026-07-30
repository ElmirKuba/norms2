import type { CounterplayFull } from '../interfaces/counterplay-full.interface';

/** DI-токен порта репозитория контрмер (биндится в obstacles.module). */
export const ACCENT_COUNTERPLAY_REPOSITORY = Symbol('ACCENT_COUNTERPLAY_REPOSITORY');

/** Данные создания контрмеры (id/позицию/таймстампы проставляет репозиторий). */
export interface CounterplayCreateData {
  /** Родительское препятствие. */
  obstacleId: string;
  /** Текст ответа. */
  text: string;
  /** Привязанная микро-победа (опц.) — контрмера станет запускаемой таймером. */
  linkedMicroWinId?: string | null;
}

/** Частичный патч контрмеры (только переданные поля). */
export interface CounterplayUpdateData {
  text?: string | undefined;
  linkedMicroWinId?: string | null | undefined;
}

/**
 * Порт репозитория контрмер, БЕЗ ORM. Скоуп — по `obstacleId` (владение препятствием проверяет
 * domain-service до вызова: контрмера сама по себе аккаунта не знает, её владелец — родитель).
 * Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentCounterplayRepositoryPort {
  /**
   * Контрмеры препятствия в ручном порядке (position, затем created_at, тай-брейкер id).
   * @param obstacleId Идентификатор препятствия.
   * @returns Список контрмер.
   */
  listByObstacle(obstacleId: string): Promise<CounterplayFull[]>;

  /**
   * Считает контрмеры для набора препятствий — для `counterplaysCount` в списке (вычисление
   * на чтение, ADR-0052: хранимого счётчика нет). Одним запросом, без N+1.
   * @param obstacleIds Идентификаторы препятствий.
   * @returns Карта `obstacleId → число контрмер` (препятствия без контрмер могут отсутствовать).
   */
  countByObstacles(obstacleIds: readonly string[]): Promise<Map<string, number>>;

  /**
   * Находит контрмеру по id в пределах препятствия.
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @returns Строка или null.
   */
  findInObstacle(id: string, obstacleId: string): Promise<CounterplayFull | null>;

  /**
   * Считает контрмеры одного препятствия (для жёсткого лимита).
   * @param obstacleId Идентификатор препятствия.
   * @returns Число контрмер.
   */
  countInObstacle(obstacleId: string): Promise<number>;

  /**
   * Создаёт контрмеру (id — `generateId()`, `position` = max+1 внутри препятствия).
   * @param data Данные создания.
   * @returns Созданная контрмера.
   */
  create(data: CounterplayCreateData): Promise<CounterplayFull>;

  /**
   * Массовое создание (сев стартового пака: примеры приходят с готовыми ответами, ADR-0051).
   * @param items Данные создания.
   * @returns Число созданных строк.
   */
  createMany(items: readonly CounterplayCreateData[]): Promise<number>;

  /**
   * Обновляет контрмеру в пределах препятствия.
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @param patch Поля для обновления.
   * @returns Обновлённая строка или null.
   */
  update(
    id: string,
    obstacleId: string,
    patch: CounterplayUpdateData,
  ): Promise<CounterplayFull | null>;

  /**
   * Удаляет контрмеру в пределах препятствия. Ссылки на неё в журнале столкновений
   * обнуляются (SET NULL) — факт «столкнулся» остаётся, теряется лишь «чем ответил».
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @returns true если удалено.
   */
  delete(id: string, obstacleId: string): Promise<boolean>;

  /**
   * Ручная сортировка контрмер внутри препятствия (ADR-0054).
   * @param obstacleId Идентификатор препятствия.
   * @param ids Желаемый порядок (сверху вниз).
   */
  reorder(obstacleId: string, ids: readonly string[]): Promise<void>;
}

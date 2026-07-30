import type {
  EncounterOutcome,
  ObstacleEncounterFull,
} from '../interfaces/obstacle-encounter-full.interface';

/** DI-токен порта репозитория журнала столкновений (биндится в obstacles.module). */
export const ACCENT_OBSTACLE_ENCOUNTER_REPOSITORY = Symbol(
  'ACCENT_OBSTACLE_ENCOUNTER_REPOSITORY',
);

/** Данные записи столкновения (id/`created_at` проставляет репозиторий). */
export interface EncounterCreateData {
  /** Препятствие. */
  obstacleId: string;
  /** Когда произошло — unix ms. */
  occurredAt: number;
  /** Чем ответил (опц.); null = «просто отметить». */
  counterplayId?: string | null;
  /** Исход (опц.) — может быть проставлен позже. */
  outcome?: EncounterOutcome | null;
  /** Заметка (опц.). */
  note?: string | null;
}

/** Keyset-курсор ленты: пара `(occurredAt, id)` — новые→старые. */
export interface EncounterCursor {
  /** Момент последнего показанного столкновения (unix ms). */
  occurredAt: number;
  /** Идентификатор последнего показанного столкновения (тай-брейкер). */
  id: string;
}

/** Опции постраничной выдачи ленты. */
export interface EncounterListOptions {
  /** Сколько запросить (репозиторий вернёт ровно столько, use-case тянет limit+1). */
  limit: number;
  /** Курсор или null (первая страница). */
  cursor: EncounterCursor | null;
}

/** Действенность одной контрмеры: «помогало `helped` из `rated`». */
export interface CounterplayEffectiveness {
  /** Идентификатор контрмеры. */
  counterplayId: string;
  /** Сколько раз отмечено `helped` (полностью сработало). */
  helpedCount: number;
  /** Сколько применений вообще получили оценку (`outcome` не пуст). */
  ratedCount: number;
}

/**
 * Порт репозитория журнала столкновений, БЕЗ ORM. Скоуп — по `obstacleId` (владение проверяет
 * domain-service выше). Журнал **append-only**, единственный modify — проставить `outcome`
 * задним числом. Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentObstacleEncounterRepositoryPort {
  /**
   * Записывает столкновение.
   * @param data Данные записи.
   * @returns Созданная запись.
   */
  insert(data: EncounterCreateData): Promise<ObstacleEncounterFull>;

  /**
   * Лента столкновений препятствия (новые→старые, keyset по `(occurred_at, id)`).
   * @param obstacleId Идентификатор препятствия.
   * @param opts Лимит и курсор.
   * @returns Записи страницы.
   */
  listByObstacle(
    obstacleId: string,
    opts: EncounterListOptions,
  ): Promise<ObstacleEncounterFull[]>;

  /**
   * Находит запись в пределах препятствия (для проставления исхода).
   * @param id Идентификатор записи.
   * @param obstacleId Идентификатор препятствия.
   * @returns Запись или null.
   */
  findInObstacle(id: string, obstacleId: string): Promise<ObstacleEncounterFull | null>;

  /**
   * Проставляет исход существующей записи (единственный modify в append-only журнале).
   * @param id Идентификатор записи.
   * @param obstacleId Идентификатор препятствия.
   * @param outcome Исход.
   * @returns Обновлённая запись или null.
   */
  setOutcome(
    id: string,
    obstacleId: string,
    outcome: EncounterOutcome,
  ): Promise<ObstacleEncounterFull | null>;

  /**
   * Считает столкновения за окно для набора препятствий — источник `encountersLast30`
   * («мешал N раз за 30 дней»). Вычисление на чтение (ADR-0052), одним запросом без N+1.
   * @param obstacleIds Идентификаторы препятствий.
   * @param sinceMs Нижняя граница `occurred_at` (unix ms).
   * @returns Карта `obstacleId → число столкновений`.
   */
  countSince(obstacleIds: readonly string[], sinceMs: number): Promise<Map<string, number>>;

  /**
   * Действенность контрмер препятствия («помогало N из M»). Считается на чтение из журнала;
   * записи **без** `outcome` в знаменатель не идут — «не отмечено» это не «не помогло».
   * @param obstacleId Идентификатор препятствия.
   * @returns Строки по контрмерам, у которых есть хотя бы одно оценённое применение.
   */
  effectivenessByObstacle(obstacleId: string): Promise<CounterplayEffectiveness[]>;
}

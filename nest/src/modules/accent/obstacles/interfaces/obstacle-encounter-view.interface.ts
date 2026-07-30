import type { ObstacleEncounterFull } from './obstacle-encounter-full.interface';
import type { EncounterOutcome } from './obstacle-encounter-full.interface';

/** ObstacleEncounterView — запись столкновения наружу. */
export interface ObstacleEncounterView {
  /** Идентификатор. */
  id: string;
  /** Препятствие. */
  obstacleId: string;
  /** Когда произошло — unix ms (как времена «держусь»: фронт форматирует сам). */
  occurredAt: number;
  /** Чем ответил или null («просто отметить»). */
  counterplayId: string | null;
  /** Исход или null. **null = «не отмечено», а не «не помогло»** (ADR-0062 п.6). */
  outcome: EncounterOutcome | null;
  /** Заметка или null. */
  note: string | null;
}

/** Страница ленты столкновений (keyset-пагинация, новые→старые). */
export interface ObstacleEncounterPage {
  /** Записи страницы. */
  items: ObstacleEncounterView[];
  /** Курсор следующей страницы или null (дальше пусто). */
  nextCursor: string | null;
}

/**
 * Проецирует запись журнала наружу.
 * @param full Доменная сущность.
 * @returns Проекция наружу.
 */
export function toEncounterView(full: ObstacleEncounterFull): ObstacleEncounterView {
  return {
    id: full.id,
    obstacleId: full.obstacleId,
    occurredAt: full.occurredAt,
    counterplayId: full.counterplayId,
    outcome: full.outcome,
    note: full.note,
  };
}

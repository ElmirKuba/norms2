/**
 * Исход столкновения — помогла ли применённая контрмера (ADR-0062 п.6). **Опционален:**
 * спрашивается ненавязчиво вторым тапом и может быть проставлен позже. Пустой `outcome` =
 * «не отмечено», а НЕ «не помогло» — в знаменатель «помогало N из M» такие записи не идут
 * (non-punitive, ADR-0049).
 */
export const ENCOUNTER_OUTCOMES = ['helped', 'partly', 'no'] as const;

/** Исход столкновения (производно от `ENCOUNTER_OUTCOMES`). */
export type EncounterOutcome = (typeof ENCOUNTER_OUTCOMES)[number];

/**
 * ObstacleEncounterFull — запись «сегодня это препятствие сработало» (колонки 1:1 со схемой
 * `obstacle_encounters`, domain-model §8, ADR-0062). **Append-only** — `version` не нужен
 * (ADR-0035, уточнение); единственный modify — проставление `outcome` задним числом.
 *
 * Журнал — источник двух вычисляемых на чтение величин: «мешал N раз за 30 дней» у препятствия
 * и «помогало N из M» у контрмеры. Хранимых счётчиков нет (ADR-0052).
 */
export interface ObstacleEncounterFull {
  /** PK — uuidv7___unixmillis (ADR-0016). */
  id: string;
  /** Препятствие — FK на `obstacles.id` (ON DELETE CASCADE). */
  obstacleId: string;
  /** Когда произошло — unix ms (как времена «держусь»: шлём на фронт и считаем арифметику). */
  occurredAt: number;
  /**
   * Чем ответил — FK на `counterplays.id` (ON DELETE SET NULL). null = «просто отметить»
   * (легальный сценарий: накрыло, разбираться некогда).
   */
  counterplayId: string | null;
  /** Исход (опц., может проставиться позже). null = не отмечено, не «не помогло». */
  outcome: EncounterOutcome | null;
  /** Заметка (опц.). Свободное поле «без ПДн» (ADR-0001). */
  note: string | null;
  /** Когда создано. */
  createdAt: Date;
}

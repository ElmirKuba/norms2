import type { CounterplayFull } from './counterplay-full.interface';

/**
 * CounterplayView — контрмера наружу. Действенность («помогало N из M») появится в блоке D
 * вместе с журналом столкновений и будет **вычисляться на чтение** (ADR-0052): записи без
 * `outcome` в знаменатель не идут — «не отмечено» это не «не помогло».
 */
export interface CounterplayView {
  /** Идентификатор. */
  id: string;
  /** Родительское препятствие. */
  obstacleId: string;
  /** Что делаю («убрать телефон в другую комнату»). */
  text: string;
  /** Привязанная микро-победа (запускает таймер в момент столкновения) или null. */
  linkedMicroWinId: string | null;
  /** Ручной порядок (ADR-0054). */
  position: number;
  /** Когда создано (ISO). */
  createdAt: string;
}

/**
 * Проецирует доменную контрмеру наружу.
 * @param full Доменная сущность.
 * @returns Проекция наружу.
 */
export function toCounterplayView(full: CounterplayFull): CounterplayView {
  return {
    id: full.id,
    obstacleId: full.obstacleId,
    text: full.text,
    linkedMicroWinId: full.linkedMicroWinId,
    position: full.position,
    createdAt: full.createdAt.toISOString(),
  };
}

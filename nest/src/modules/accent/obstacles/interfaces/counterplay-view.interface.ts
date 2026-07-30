import type { CounterplayFull } from './counterplay-full.interface';

/**
 * CounterplayView — контрмера наружу. Действенность («помогало N из M») **вычисляется на
 * чтение** из журнала (ADR-0052): записи без `outcome` в знаменатель не идут — «не отмечено»
 * это не «не помогло». Список при этом **не переупорядочивается** по действенности: подсказка
 * есть, порядок остаётся за человеком (ADR-0062 п.7).
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
  /** Сколько раз ответ отмечен как «помог» (`outcome='helped'`). */
  helpedCount: number;
  /** Сколько применений вообще получили оценку («помогало `helpedCount` из `ratedCount`»). */
  ratedCount: number;
  /** Когда создано (ISO). */
  createdAt: string;
}

/**
 * Проецирует доменную контрмеру наружу.
 * @param full Доменная сущность.
 * @param helpedCount Сколько раз отмечено «помогло» (0 если оценок нет).
 * @param ratedCount Сколько применений оценено (0 если оценок нет).
 * @returns Проекция наружу.
 */
export function toCounterplayView(
  full: CounterplayFull,
  helpedCount = 0,
  ratedCount = 0,
): CounterplayView {
  return {
    id: full.id,
    obstacleId: full.obstacleId,
    text: full.text,
    linkedMicroWinId: full.linkedMicroWinId,
    position: full.position,
    helpedCount,
    ratedCount,
    createdAt: full.createdAt.toISOString(),
  };
}

import type { MilestoneWithReached } from '../domain-services/accent-goal.domain-service';

/** MilestoneView — веха наружу (без `goalId`/таймстампа; с вычисленным `reached`). */
export interface MilestoneView {
  /** Идентификатор. */
  id: string;
  /** Название. */
  title: string;
  /** Порог достижения. */
  thresholdValue: number;
  /** Достигнута ли (вычислено из текущего прогресса цели, ADR-0052). */
  reached: boolean;
}

/**
 * Проецирует веху с достигнутостью в наружную view.
 * @param item Веха + флаг `reached`.
 * @returns Проекция наружу.
 */
export function toMilestoneView(item: MilestoneWithReached): MilestoneView {
  return {
    id: item.milestone.id,
    title: item.milestone.title,
    thresholdValue: item.milestone.thresholdValue,
    reached: item.reached,
  };
}

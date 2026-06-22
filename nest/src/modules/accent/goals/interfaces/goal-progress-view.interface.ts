import type { GoalFull } from './goal-full.interface';
import { toGoalView } from './goal-view.interface';
import type { GoalView } from './goal-view.interface';
import type { GoalProgress } from '../goal-progress.util';

/**
 * GoalProgressView — цель наружу с **вычисляемым прогрессом** (ADR-0052): базовые поля
 * `GoalView` + `currentValue/percentage/daysLeft/pace/forecast/projectedCompletionDate`.
 * Отдают read-эндпоинты (`GET /accent/goals`, `GET /:id`); мутации возвращают базовый `GoalView`.
 */
export type GoalProgressView = GoalView & GoalProgress;

/**
 * Собирает `GoalProgressView` из доменной цели и посчитанного прогресса.
 * @param goal Доменная цель.
 * @param progress Вычисляемый прогресс (из `AccentGoalDomainService.describe`).
 * @returns Проекция с прогрессом.
 */
export function toGoalProgressView(goal: GoalFull, progress: GoalProgress): GoalProgressView {
  return { ...toGoalView(goal), ...progress };
}

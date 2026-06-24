import type { GoalView } from './goal-view.interface';

/**
 * Результат переключения «фокуса» цели (ADR-0053) наружу: обновлённая цель + мета фокуса для
 * мягкого предупреждения. `overLimit=true` → фронт показывает вопрос «уже N в фокусе — что-то
 * отпустишь?» (НЕ блок).
 */
export interface GoalFocusResult {
  /** Обновлённая цель (с актуальным `focusOrder`). */
  goal: GoalView;
  /** Сколько целей сейчас в фокусе у аккаунта. */
  focusedCount: number;
  /** Мягкий порог (env `ACCENT_GOAL_FOCUS_SOFT_LIMIT`). */
  softLimit: number;
  /** Превышен ли порог после операции (для мягкого вопроса; не блокирует). */
  overLimit: boolean;
}

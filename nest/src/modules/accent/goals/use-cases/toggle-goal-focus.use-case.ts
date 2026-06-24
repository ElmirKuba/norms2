import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalView } from '../interfaces/goal-view.interface';
import type { GoalFocusResult } from '../interfaces/goal-focus-result.interface';

/**
 * Use-case переключения «фокуса» цели (ADR-0053, 2.5·24): `POST /accent/goals/:id/focus` (в фокус) /
 * `DELETE …/focus` (из фокуса). Возвращает цель + мету для мягкого предупреждения (overLimit).
 */
@Injectable()
export class ToggleGoalFocusUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param focused true — в фокус; false — из фокуса.
   * @returns Цель + мета фокуса.
   */
  public async execute(id: string, accountId: string, focused: boolean): Promise<GoalFocusResult> {
    const r = await this._goals.toggleFocus(id, accountId, focused);
    return {
      goal: toGoalView(r.goal),
      focusedCount: r.focusedCount,
      softLimit: r.softLimit,
      overLimit: r.overLimit,
    };
  }
}

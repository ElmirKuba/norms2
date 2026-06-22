import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { GoalProgressView } from '../interfaces/goal-progress-view.interface';

/**
 * Use-case одной цели (`GET /accent/goals/:id`). Тонкий: domain → проекция с **вычисляемым
 * прогрессом** (ADR-0052).
 */
@Injectable()
export class GetGoalUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone TZ пользователя (для forecast/daysLeft).
   * @returns Проекция цели с прогрессом.
   */
  public async execute(id: string, accountId: string, timezone: string): Promise<GoalProgressView> {
    const found = await this._goals.getOwned(id, accountId);
    return toGoalProgressView(found, await this._goals.describe(found, timezone));
  }
}

import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalView } from '../interfaces/goal-view.interface';
import type { GoalView } from '../interfaces/goal-view.interface';

/** Use-case одной цели (`GET /accent/goals/:id`). Тонкий: domain → проекция. */
@Injectable()
export class GetGoalUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция цели.
   */
  public async execute(id: string, accountId: string): Promise<GoalView> {
    const found = await this._goals.getOwned(id, accountId);
    return toGoalView(found);
  }
}

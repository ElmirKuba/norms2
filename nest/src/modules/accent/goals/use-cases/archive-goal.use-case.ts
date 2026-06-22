import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalView } from '../interfaces/goal-view.interface';
import type { GoalView } from '../interfaces/goal-view.interface';

/** Use-case архивации цели (`POST /accent/goals/:id/archive`). */
@Injectable()
export class ArchiveGoalUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция архивированной цели.
   */
  public async execute(id: string, accountId: string): Promise<GoalView> {
    return toGoalView(await this._goals.archive(id, accountId));
  }
}

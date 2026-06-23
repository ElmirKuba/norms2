import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toMilestoneView } from '../interfaces/milestone-view.interface';
import type { MilestoneView } from '../interfaces/milestone-view.interface';

/** Use-case списка вех цели (`GET /accent/goals/:id/milestones`) с вычисленным `reached`. */
@Injectable()
export class ListMilestonesUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param goalId Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекции вех (по возрастанию порога).
   */
  public async execute(goalId: string, accountId: string): Promise<MilestoneView[]> {
    const items = await this._goals.listMilestones(goalId, accountId);
    return items.map((item) => toMilestoneView(item));
  }
}

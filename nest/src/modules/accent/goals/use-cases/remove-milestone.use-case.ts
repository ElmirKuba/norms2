import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';

/** Use-case удаления вехи (`DELETE /accent/goals/:id/milestones/:mid`) — только не достигнутой. */
@Injectable()
export class RemoveMilestoneUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param goalId Идентификатор цели.
   * @param milestoneId Идентификатор вехи.
   * @param accountId Идентификатор аккаунта (из Guard).
   */
  public async execute(goalId: string, milestoneId: string, accountId: string): Promise<void> {
    await this._goals.removeMilestone(goalId, milestoneId, accountId);
  }
}

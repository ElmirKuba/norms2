import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import type { MilestoneView } from '../interfaces/milestone-view.interface';
import type { AddMilestoneDto } from '../dtos/add-milestone.dto';

/** Use-case добавления вехи (`POST /accent/goals/:id/milestones`). Свежесозданная — не достигнута. */
@Injectable()
export class AddMilestoneUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param goalId Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Название + порог.
   * @returns Проекция созданной вехи.
   */
  public async execute(
    goalId: string,
    accountId: string,
    dto: AddMilestoneDto,
  ): Promise<MilestoneView> {
    const milestone = await this._goals.addMilestone(goalId, accountId, dto);
    return { id: milestone.id, title: milestone.title, thresholdValue: milestone.thresholdValue, reached: false };
  }
}

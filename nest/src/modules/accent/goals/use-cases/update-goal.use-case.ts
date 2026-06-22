import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalView } from '../interfaces/goal-view.interface';
import type { GoalView } from '../interfaces/goal-view.interface';
import type { UpdateGoalDto } from '../dtos/update-goal.dto';

/**
 * Use-case обновления цели (`PATCH /accent/goals/:id`). Тонкий: domain валидирует
 * переданные поля (last-write-wins) и пишет.
 */
@Injectable()
export class UpdateGoalUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Поля для обновления.
   * @returns Проекция обновлённой цели.
   */
  public async execute(id: string, accountId: string, dto: UpdateGoalDto): Promise<GoalView> {
    const updated = await this._goals.update(id, accountId, dto);
    return toGoalView(updated);
  }
}

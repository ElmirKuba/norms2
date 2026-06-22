import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalView } from '../interfaces/goal-view.interface';
import type { GoalView } from '../interfaces/goal-view.interface';
import type { GoalListFilters } from '../adapters/accent-goal-repository.port';

/** Use-case списка целей (`GET /accent/goals?status&domain`). Тонкий: domain → проекции. */
@Injectable()
export class ListGoalsUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param filters Фильтр (статус/сфера).
   * @returns Проекции целей.
   */
  public async execute(accountId: string, filters?: GoalListFilters): Promise<GoalView[]> {
    const items = await this._goals.list(accountId, filters);
    return items.map((item) => toGoalView(item));
  }
}

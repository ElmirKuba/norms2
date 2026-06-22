import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { GoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { GoalListFilters } from '../adapters/accent-goal-repository.port';

/**
 * Use-case списка целей (`GET /accent/goals?status&domain`). Тонкий: domain → проекции
 * с **вычисляемым прогрессом** (ADR-0052; `describe` на каждую цель).
 */
@Injectable()
export class ListGoalsUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone TZ пользователя (для forecast/daysLeft).
   * @param filters Фильтр (статус/сфера).
   * @returns Проекции целей с прогрессом.
   */
  public async execute(
    accountId: string,
    timezone: string,
    filters?: GoalListFilters,
  ): Promise<GoalProgressView[]> {
    const items = await this._goals.list(accountId, filters);
    return Promise.all(
      items.map(async (item) =>
        toGoalProgressView(item, await this._goals.describe(item, timezone)),
      ),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { GoalProgressView } from '../interfaces/goal-progress-view.interface';

/**
 * Use-case прямых подцелей цели (`GET /accent/goals/:id/children`, 2.5·23 P3#5). Проверяет
 * владение родителем, отдаёт детей с вычисляемым прогрессом. Заменяет клиентский фильтр
 * «загрузить все цели» на детальном экране.
 */
@Injectable()
export class ListChildGoalsUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param parentId Идентификатор родительской цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone TZ пользователя.
   * @returns Проекции подцелей с прогрессом.
   */
  public async execute(
    parentId: string,
    accountId: string,
    timezone: string,
  ): Promise<GoalProgressView[]> {
    await this._goals.getOwned(parentId, accountId); // 404, если нет / не ваша
    const children = await this._goals.listChildren(parentId, accountId);
    return Promise.all(
      children.map(async (child) =>
        toGoalProgressView(child, await this._goals.describe(child, timezone)),
      ),
    );
  }
}

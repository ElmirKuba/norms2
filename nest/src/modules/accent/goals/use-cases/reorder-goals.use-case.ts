import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';

/** Use-case ручной сортировки целей (`PUT /accent/goals/reorder`, ADR-0054, 2.5·27). */
@Injectable()
export class ReorderGoalsUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param ids Желаемый порядок id.
   */
  public async execute(accountId: string, ids: readonly string[]): Promise<void> {
    await this._goals.reorder(accountId, ids);
  }
}

import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';

/** Use-case удаления записи прогресса (`DELETE /accent/goals/:id/entries/:entryId`, патч 8). */
@Injectable()
export class RemoveGoalEntryUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param goalId Идентификатор цели.
   * @param entryId Идентификатор записи.
   * @param accountId Идентификатор аккаунта (из Guard).
   */
  public async execute(goalId: string, entryId: string, accountId: string): Promise<void> {
    await this._goals.removeEntry(goalId, entryId, accountId);
  }
}

import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';

/** Use-case очистки примеров целей (`DELETE /accent/goals/starter-pack`, патч 9). */
@Injectable()
export class ClearGoalStartersUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Число удалённых.
   */
  public async execute(accountId: string): Promise<number> {
    return this._goals.clearStarters(accountId);
  }
}

import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';

/** Use-case перестановки ранга фокуса целей (`PUT /accent/goals/focus-reorder`, ADR-0053/0054). */
@Injectable()
export class ReorderGoalFocusUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param ids Желаемый порядок фокусных целей.
   */
  public async execute(accountId: string, ids: readonly string[]): Promise<void> {
    await this._goals.reorderFocus(accountId, ids);
  }
}

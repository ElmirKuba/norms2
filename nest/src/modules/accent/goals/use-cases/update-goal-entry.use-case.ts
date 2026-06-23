import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalEntryView } from '../interfaces/goal-entry-view.interface';
import type { GoalEntryView } from '../interfaces/goal-entry-view.interface';
import type { UpdateGoalEntryDto } from '../dtos/update-goal-entry.dto';

/** Use-case правки записи прогресса (`PATCH /accent/goals/:id/entries/:entryId`, патч 8). */
@Injectable()
export class UpdateGoalEntryUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param goalId Идентификатор цели.
   * @param entryId Идентификатор записи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Поля для правки.
   * @returns Обновлённая запись.
   */
  public async execute(
    goalId: string,
    entryId: string,
    accountId: string,
    dto: UpdateGoalEntryDto,
  ): Promise<GoalEntryView> {
    const patch: { value?: number; occurredOn?: string; note?: string | null } = {};
    if (dto.value !== undefined) {
      patch.value = dto.value;
    }
    if (dto.occurredOn !== undefined) {
      patch.occurredOn = dto.occurredOn;
    }
    if (dto.note !== undefined) {
      patch.note = dto.note;
    }
    return toGoalEntryView(await this._goals.updateEntry(goalId, entryId, accountId, patch));
  }
}

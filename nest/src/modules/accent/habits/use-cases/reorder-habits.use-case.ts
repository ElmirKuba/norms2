import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';

/** Use-case ручной сортировки привычек (`PUT /accent/habits/reorder`, ADR-0054, 2.5·27). */
@Injectable()
export class ReorderHabitsUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param ids Желаемый порядок id.
   */
  public async execute(accountId: string, ids: readonly string[]): Promise<void> {
    await this._habits.reorder(accountId, ids);
  }
}

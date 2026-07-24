import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';

/** Use-case ручной сортировки анти-привычек (`PUT /accent/anti-habits/reorder`). Тонкий. */
@Injectable()
export class ReorderAntiHabitsUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param ids Желаемый порядок (сверху вниз).
   */
  public async execute(accountId: string, ids: readonly string[]): Promise<void> {
    await this._antiHabits.reorder(accountId, ids);
  }
}

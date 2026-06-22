import { Injectable } from '@nestjs/common';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalEntryView } from '../interfaces/goal-entry-view.interface';
import type { GoalEntryView } from '../interfaces/goal-entry-view.interface';
import { toGoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { GoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { AddGoalEntryDto } from '../dtos/add-goal-entry.dto';

/** Ответ добавления записи: сама запись + актуальная цель с прогрессом (возможно завершённая). */
export interface AddGoalEntryResult {
  /** Созданная запись. */
  entry: GoalEntryView;
  /** Цель с пересчитанным прогрессом. */
  goal: GoalProgressView;
}

/**
 * Use-case добавления записи прогресса (`POST /accent/goals/:id/entries`). Тонкий: domain
 * добавляет запись + авто-завершает при достижении target, затем считает прогресс.
 */
@Injectable()
export class AddGoalEntryUseCase {
  /**
   * @param _goals Domain-service целей.
   */
  public constructor(private readonly _goals: AccentGoalDomainService) {}

  /**
   * @param goalId Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело (значение/дата/заметка).
   * @param timezone TZ пользователя (дата по умолчанию + forecast).
   * @returns Запись + цель с прогрессом.
   */
  public async execute(
    goalId: string,
    accountId: string,
    dto: AddGoalEntryDto,
    timezone: string,
  ): Promise<AddGoalEntryResult> {
    const { entry, goal } = await this._goals.addEntry(
      goalId,
      accountId,
      { value: dto.value, occurredOn: dto.occurredOn ?? null, note: dto.note ?? null },
      timezone,
    );
    return {
      entry: toGoalEntryView(entry),
      goal: toGoalProgressView(goal, await this._goals.describe(goal, timezone)),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';

/** Use-case одной привычки (`GET /accent/habits/:id`). Тонкий: domain (404) → проекция. */
@Injectable()
export class GetHabitUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция привычки.
   */
  public async execute(id: string, accountId: string): Promise<HabitView> {
    return toHabitView(await this._habits.getOwned(id, accountId));
  }
}

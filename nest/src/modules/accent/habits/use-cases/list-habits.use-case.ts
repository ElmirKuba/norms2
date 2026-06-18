import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';

/** Use-case списка привычек (`GET /accent/habits`). Тонкий: domain → проекции. */
@Injectable()
export class ListHabitsUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекции активных привычек.
   */
  public async execute(accountId: string): Promise<HabitView[]> {
    const items = await this._habits.list(accountId);
    return items.map((item) => toHabitView(item));
  }
}

import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';

/** Use-case одной анти-привычки (`GET /accent/anti-habits/:id`). Тонкий. */
@Injectable()
export class GetAntiHabitUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция анти-привычки.
   */
  public async execute(id: string, accountId: string): Promise<AntiHabitView> {
    const found = await this._antiHabits.getOwned(id, accountId);
    return toAntiHabitView(found);
  }
}

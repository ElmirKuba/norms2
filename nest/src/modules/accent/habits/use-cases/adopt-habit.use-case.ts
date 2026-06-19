import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';

/**
 * Use-case присвоения примера («Добавить себе», `POST /accent/habits/:id/adopt`, ADR-0051).
 * Тонкий: domain снимает `is_starter` → привычка становится обычной (материализует задачи).
 */
@Injectable()
export class AdoptHabitUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция присвоенной привычки.
   */
  public async execute(id: string, accountId: string): Promise<HabitView> {
    return toHabitView(await this._habits.adopt(id, accountId));
  }
}

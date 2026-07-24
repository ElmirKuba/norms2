import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';

/** Use-case присвоения примера «держусь» («Добавить себе», `POST /accent/anti-habits/:id/adopt`). */
@Injectable()
export class AdoptAntiHabitUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция присвоенной анти-привычки.
   */
  public async execute(id: string, accountId: string): Promise<AntiHabitView> {
    return toAntiHabitView(await this._antiHabits.adopt(id, accountId));
  }
}

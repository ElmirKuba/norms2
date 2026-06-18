import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';

/**
 * Use-case деактивации привычки (`POST /accent/habits/:id/deactivate`). Тонкий: domain
 * мягко гасит (`isActive=false`), из материализации исчезает.
 */
@Injectable()
export class DeactivateHabitUseCase {
  /**
   * @param _habits Domain-service привычек.
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция деактивированной привычки.
   */
  public async execute(id: string, accountId: string): Promise<HabitView> {
    return toHabitView(await this._habits.deactivate(id, accountId));
  }
}

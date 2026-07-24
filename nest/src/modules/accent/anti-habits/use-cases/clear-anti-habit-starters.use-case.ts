import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';

/** Use-case очистки примеров «держусь» (`DELETE /accent/anti-habits/starter-pack`, ADR-0051). */
@Injectable()
export class ClearAntiHabitStartersUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Число удалённых.
   */
  public async execute(accountId: string): Promise<number> {
    return this._antiHabits.clearStarters(accountId);
  }
}

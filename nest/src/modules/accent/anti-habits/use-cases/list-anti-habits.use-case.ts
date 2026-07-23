import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';

/** Use-case списка анти-привычек аккаунта (`GET /accent/anti-habits`). Тонкий. */
@Injectable()
export class ListAntiHabitsUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекции анти-привычек (единый `now` для стабильного снимка серий).
   */
  public async execute(accountId: string): Promise<AntiHabitView[]> {
    const items = await this._antiHabits.list(accountId);
    const now = Date.now();
    return items.map((item) => toAntiHabitView(item, now));
  }
}

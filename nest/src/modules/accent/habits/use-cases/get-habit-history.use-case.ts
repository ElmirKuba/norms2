import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentHabitHistoryDomainService } from '../domain-services/accent-habit-history.domain-service';
import type { HabitHistoryView } from '../interfaces/habit-history-view.interface';

/**
 * Use-case истории привычки (`GET /accent/habits/:id/history`, 2.7.3). Тонкий: считает «сегодня»
 * по таймзоне аккаунта (домен о таймзонах не знает) и отдаёт готовую страницу.
 *
 * **Материализацию не зовёт** — в отличие от списка задач дня. История читается, а не создаётся.
 */
@Injectable()
export class GetHabitHistoryUseCase {
  /**
   * @param _history Domain-service истории привычки.
   */
  public constructor(private readonly _history: AccentHabitHistoryDomainService) {}

  /**
   * @param habitId Идентификатор привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @param options `before` — курсор «Показать ещё», `limit` — размер страницы.
   * @returns Страница истории.
   */
  public async execute(
    habitId: string,
    accountId: string,
    timezone: string,
    options: { before?: string; limit?: number } = {},
  ): Promise<HabitHistoryView> {
    return this._history.page(
      habitId,
      accountId,
      todayInTimezone(timezone),
      timezone,
      options,
    );
  }
}

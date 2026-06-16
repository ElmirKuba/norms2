import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';
import { toMicroWinView } from '../interfaces/micro-win-view.interface';
import type { MicroWinView } from '../interfaces/micro-win-view.interface';

/**
 * Use-case списка микро-побед (`GET /accent/micro-wins`). Тонкий: domain → проекции
 * с `completedToday` (по логам за сегодня в TZ аккаунта — дневной фидбэк).
 */
@Injectable()
export class ListMicroWinsUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard) — для «сегодня».
   * @returns Проекции активных микро-побед с актуальным `completedToday`.
   */
  public async execute(accountId: string, timezone: string): Promise<MicroWinView[]> {
    const items = await this._microWins.list(accountId);
    const today = todayInTimezone(timezone);
    const completedToday = await this._microWins.completedIdsOn(accountId, today);
    return items.map((item) => toMicroWinView(item, completedToday.has(item.id)));
  }
}

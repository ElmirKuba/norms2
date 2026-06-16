import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';
import { toMicroWinView } from '../interfaces/micro-win-view.interface';
import type { MicroWinView } from '../interfaces/micro-win-view.interface';

/**
 * Use-case отметки выполнения микро-победы (`POST /accent/micro-wins/:id/complete`).
 * Тонкий: вычисляет день (переданный `occurredOn` или «сегодня» в TZ аккаунта),
 * domain логирует идемпотентно (дневной лимит) и проверяет владение, затем
 * возвращает проекцию с актуальным `completedToday` (по логам за сегодня).
 */
@Injectable()
export class CompleteMicroWinUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @param occurredOn Опц. дата `YYYY-MM-DD` (бэкдейт); по умолчанию — сегодня в TZ.
   * @returns Проекция микро-победы с `completedToday` на сегодня.
   */
  public async execute(
    id: string,
    accountId: string,
    timezone: string,
    occurredOn?: string,
  ): Promise<MicroWinView> {
    const today = todayInTimezone(timezone);
    const { microWin } = await this._microWins.complete(id, accountId, occurredOn ?? today);
    const completedToday = await this._microWins.completedIdsOn(accountId, today);
    return toMicroWinView(microWin, completedToday.has(id));
  }
}

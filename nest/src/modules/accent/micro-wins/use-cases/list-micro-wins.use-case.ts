import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentSettingsDomainService } from '../../settings/domain-services/accent-settings.domain-service';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';
import { toMicroWinView } from '../interfaces/micro-win-view.interface';
import type { MicroWinView } from '../interfaces/micro-win-view.interface';

/**
 * Use-case списка микро-побед (`GET /accent/micro-wins`). Тонкий: при первом заходе
 * идемпотентно заводит персональный стартовый набор (2.2·5), затем domain → проекции
 * с `completedToday` (по логам за сегодня в TZ аккаунта). Кросс-домен вниз: зовёт
 * settings-domain (claim-флаг) — точка координации в use-case (ADR-0050).
 */
@Injectable()
export class ListMicroWinsUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   * @param _settings Domain-service настроек (флаг сева стартового набора).
   */
  public constructor(
    private readonly _microWins: AccentMicroWinDomainService,
    private readonly _settings: AccentSettingsDomainService,
  ) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard) — для «сегодня».
   * @returns Проекции активных микро-побед с актуальным `completedToday`.
   */
  public async execute(accountId: string, timezone: string): Promise<MicroWinView[]> {
    await this._ensureStarterSet(accountId);
    const items = await this._microWins.list(accountId);
    const today = todayInTimezone(timezone);
    const completedToday = await this._microWins.completedIdsOn(accountId, today);
    return items.map((item) => toMicroWinView(item, completedToday.has(item.id)));
  }

  /**
   * Идемпотентно сеет стартовый набор: сначала дешёвая проверка флага, при null —
   * атомарный claim (CAS) и сев только победителю гонки (двойного сева не будет).
   * @param accountId Идентификатор аккаунта.
   */
  private async _ensureStarterSet(accountId: string): Promise<void> {
    const settings = await this._settings.getOrCreate(accountId);
    if (settings.starterMicroWinsSeededAt !== null) {
      return;
    }
    const claimed = await this._settings.claimMicroWinsStarter(accountId);
    if (claimed) {
      await this._microWins.createStarterSet(accountId);
    }
  }
}

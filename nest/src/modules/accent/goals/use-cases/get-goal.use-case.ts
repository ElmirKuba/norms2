import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../../micro-wins/domain-services/accent-micro-win.domain-service';
import { AccentGoalDomainService } from '../domain-services/accent-goal.domain-service';
import { toGoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { GoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { GoalFallbackAction } from '../interfaces/goal-view.interface';

/**
 * Use-case одной цели (`GET /accent/goals/:id`). Тонкий: domain → проекция с **вычисляемым
 * прогрессом** (ADR-0052). Плюс разворачивает привязанную «версию на плохой день» (2.7.2) —
 * кросс-домен **вниз**: use-case целей зовёт domain-service микро-побед, не их use-case.
 */
@Injectable()
export class GetGoalUseCase {
  /**
   * @param _goals Domain-service целей.
   * @param _microWins Domain-service микро-побед (для «версии на плохой день»).
   */
  public constructor(
    private readonly _goals: AccentGoalDomainService,
    private readonly _microWins: AccentMicroWinDomainService,
  ) {}

  /**
   * @param id Идентификатор цели.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone TZ пользователя (для forecast/daysLeft).
   * @returns Проекция цели с прогрессом.
   */
  public async execute(id: string, accountId: string, timezone: string): Promise<GoalProgressView> {
    const found = await this._goals.getOwned(id, accountId);
    return toGoalProgressView(
      found,
      await this._goals.describe(found, timezone),
      await this._fallbackAction(found.fallbackMicroWinId, accountId),
    );
  }

  /**
   * Разворачивает привязанную микро-победу в данные для кнопки и таймера. Микро-победу могли
   * удалить — тогда ссылка уже `NULL` (SET NULL), но подстраховываемся и на исчезновение.
   * @param microWinId Идентификатор привязанной микро-победы или null.
   * @param accountId Идентификатор аккаунта.
   * @returns Действие «на плохой день» или null.
   */
  private async _fallbackAction(
    microWinId: string | null,
    accountId: string,
  ): Promise<GoalFallbackAction | null> {
    if (microWinId === null) {
      return null;
    }
    const microWin = (await this._microWins.list(accountId)).find((mw) => mw.id === microWinId);
    if (microWin === undefined) {
      return null;
    }
    return {
      microWinId: microWin.id,
      title: microWin.title,
      durationSeconds: microWin.durationSeconds,
      prepSeconds: microWin.prepSeconds,
    };
  }
}

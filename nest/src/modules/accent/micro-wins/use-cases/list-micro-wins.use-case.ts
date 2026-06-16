import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';
import { toMicroWinView } from '../interfaces/micro-win-view.interface';
import type { MicroWinView } from '../interfaces/micro-win-view.interface';

/**
 * Use-case списка микро-побед (`GET /accent/micro-wins`). Тонкий: domain → проекции.
 */
@Injectable()
export class ListMicroWinsUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекции активных микро-побед.
   */
  public async execute(accountId: string): Promise<MicroWinView[]> {
    const items = await this._microWins.list(accountId);
    // TODO: Claude Code: 2026-06-16: 2.2·4 — completedToday по логам за сегодня (TZ аккаунта).
    return items.map((item) => toMicroWinView(item, false));
  }
}

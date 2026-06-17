import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';

/**
 * Use-case получения стартового пака (`POST /accent/micro-wins/starter-pack`). Тонкий:
 * domain докидывает стартовые победы (`is_starter=true`, дедуп по названию, своё не трогает).
 * Свежий список возвращает контроллер через `ListMicroWinsUseCase`.
 */
@Injectable()
export class SeedStarterPackUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Число созданных стартовых побед.
   */
  public async execute(accountId: string): Promise<number> {
    return this._microWins.seedStarterPack(accountId);
  }
}

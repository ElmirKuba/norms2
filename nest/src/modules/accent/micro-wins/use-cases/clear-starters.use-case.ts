import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';

/**
 * Use-case очистки примеров (`DELETE /accent/micro-wins/starter-pack`). Тонкий:
 * domain удаляет только ещё не присвоенные стартовые (`is_starter=true`), своё не трогает.
 * Свежий список возвращает контроллер через `ListMicroWinsUseCase`.
 */
@Injectable()
export class ClearStartersUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Число удалённых стартовых побед.
   */
  public async execute(accountId: string): Promise<number> {
    return this._microWins.clearStarters(accountId);
  }
}

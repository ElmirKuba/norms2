import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';

/**
 * Use-case удаления микро-победы (`DELETE /accent/micro-wins/:id`). Тонкий:
 * domain проверяет владение и удаляет (логи каскадятся по FK).
 */
@Injectable()
export class DeleteMicroWinUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта (из Guard).
   */
  public async execute(id: string, accountId: string): Promise<void> {
    await this._microWins.remove(id, accountId);
  }
}

import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';

/** Use-case ручной сортировки микро-побед (`PUT /accent/micro-wins/reorder`, ADR-0054, 2.5·27). */
@Injectable()
export class ReorderMicroWinsUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param ids Желаемый порядок id.
   */
  public async execute(accountId: string, ids: readonly string[]): Promise<void> {
    await this._microWins.reorder(accountId, ids);
  }
}

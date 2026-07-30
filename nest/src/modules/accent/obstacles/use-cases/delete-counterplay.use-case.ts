import { Injectable } from '@nestjs/common';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';

/**
 * Use-case удаления контрмеры (`DELETE /accent/obstacles/:id/counterplays/:cid`). Записи
 * журнала, где ответ применялся, остаются — теряется лишь «чем ответил» (SET NULL).
 */
@Injectable()
export class DeleteCounterplayUseCase {
  /**
   * @param _counterplays Domain-service контрмер.
   */
  public constructor(private readonly _counterplays: AccentCounterplayDomainService) {}

  /**
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @param accountId Идентификатор аккаунта (из Guard).
   */
  public async execute(id: string, obstacleId: string, accountId: string): Promise<void> {
    await this._counterplays.remove(id, obstacleId, accountId);
  }
}

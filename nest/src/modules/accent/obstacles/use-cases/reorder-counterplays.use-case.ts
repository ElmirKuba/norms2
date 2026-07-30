import { Injectable } from '@nestjs/common';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import type { ReorderCounterplaysDto } from '../dtos/reorder-counterplays.dto';

/** Use-case сортировки контрмер (`PUT /accent/obstacles/:id/counterplays/reorder`). */
@Injectable()
export class ReorderCounterplaysUseCase {
  /**
   * @param _counterplays Domain-service контрмер.
   */
  public constructor(private readonly _counterplays: AccentCounterplayDomainService) {}

  /**
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Желаемый порядок id.
   */
  public async execute(
    obstacleId: string,
    accountId: string,
    dto: ReorderCounterplaysDto,
  ): Promise<void> {
    await this._counterplays.reorder(obstacleId, accountId, dto.ids);
  }
}

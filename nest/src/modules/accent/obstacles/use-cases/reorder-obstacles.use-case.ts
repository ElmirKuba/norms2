import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import type { ReorderObstaclesDto } from '../dtos/reorder-obstacles.dto';

/** Use-case ручной сортировки препятствий (`PUT /accent/obstacles/reorder`, ADR-0054). */
@Injectable()
export class ReorderObstaclesUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   */
  public constructor(private readonly _obstacles: AccentObstacleDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Желаемый порядок id (сверху вниз).
   */
  public async execute(accountId: string, dto: ReorderObstaclesDto): Promise<void> {
    await this._obstacles.reorder(accountId, dto.ids);
  }
}

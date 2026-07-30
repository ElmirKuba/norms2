import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleListView } from '../interfaces/obstacle-view.interface';

/** Use-case списка препятствий аккаунта (`GET /accent/obstacles`). Тонкий. */
@Injectable()
export class ListObstaclesUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   */
  public constructor(private readonly _obstacles: AccentObstacleDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Препятствия в ручном порядке + флаг мягкого порога (подсказка, не запрет).
   */
  public async execute(accountId: string): Promise<ObstacleListView> {
    const { items, softLimitExceeded } = await this._obstacles.list(accountId);
    return { items: items.map(toObstacleView), softLimitExceeded };
  }
}

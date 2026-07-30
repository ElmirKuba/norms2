import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleListView } from '../interfaces/obstacle-view.interface';

/** Use-case списка препятствий аккаунта (`GET /accent/obstacles`). Тонкий. */
@Injectable()
export class ListObstaclesUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   * @param _counterplays Domain-service контрмер (счётчики одним запросом, без N+1).
   */
  public constructor(
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _counterplays: AccentCounterplayDomainService,
  ) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Препятствия в ручном порядке + флаг мягкого порога (подсказка, не запрет).
   */
  public async execute(accountId: string): Promise<ObstacleListView> {
    const { items, softLimitExceeded } = await this._obstacles.list(accountId);
    const counts = await this._counterplays.countByObstacles(items.map((o) => o.id));
    return {
      items: items.map((o) => toObstacleView(o, counts.get(o.id) ?? 0)),
      softLimitExceeded,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { AccentObstacleEncounterDomainService } from '../domain-services/accent-obstacle-encounter.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleListView } from '../interfaces/obstacle-view.interface';

/** Use-case списка препятствий аккаунта (`GET /accent/obstacles`). Тонкий. */
@Injectable()
export class ListObstaclesUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   * @param _counterplays Domain-service контрмер (счётчики одним запросом, без N+1).
   * @param _encounters Domain-service журнала (частота за 30 дней).
   */
  public constructor(
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _counterplays: AccentCounterplayDomainService,
    private readonly _encounters: AccentObstacleEncounterDomainService,
  ) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Препятствия в ручном порядке + флаг мягкого порога (подсказка, не запрет).
   */
  public async execute(accountId: string): Promise<ObstacleListView> {
    const { items, softLimitExceeded } = await this._obstacles.list(accountId);
    const ids = items.map((o) => o.id);
    const [counts, encounters] = await Promise.all([
      this._counterplays.countByObstacles(ids),
      this._encounters.countsLast30(ids),
    ]);
    return {
      items: items.map((o) => toObstacleView(o, counts.get(o.id) ?? 0, encounters.get(o.id) ?? 0)),
      softLimitExceeded,
    };
  }
}

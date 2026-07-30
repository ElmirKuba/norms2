import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { AccentObstacleEncounterDomainService } from '../domain-services/accent-obstacle-encounter.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleView } from '../interfaces/obstacle-view.interface';

/** Use-case одного препятствия (`GET /accent/obstacles/:id`). Тонкий. */
@Injectable()
export class GetObstacleUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   * @param _counterplays Domain-service контрмер (счётчик ответов).
   * @param _encounters Domain-service журнала (частота за 30 дней).
   */
  public constructor(
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _counterplays: AccentCounterplayDomainService,
    private readonly _encounters: AccentObstacleEncounterDomainService,
  ) {}

  /**
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция препятствия.
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   */
  public async execute(id: string, accountId: string): Promise<ObstacleView> {
    const obstacle = await this._obstacles.getOwned(id, accountId);
    const [counts, encounters] = await Promise.all([
      this._counterplays.countByObstacles([obstacle.id]),
      this._encounters.countsLast30([obstacle.id]),
    ]);
    return toObstacleView(
      obstacle,
      counts.get(obstacle.id) ?? 0,
      encounters.get(obstacle.id) ?? 0,
    );
  }
}

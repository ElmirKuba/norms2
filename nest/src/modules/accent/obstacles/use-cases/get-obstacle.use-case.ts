import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleView } from '../interfaces/obstacle-view.interface';

/** Use-case одного препятствия (`GET /accent/obstacles/:id`). Тонкий. */
@Injectable()
export class GetObstacleUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   * @param _counterplays Domain-service контрмер (счётчик ответов).
   */
  public constructor(
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _counterplays: AccentCounterplayDomainService,
  ) {}

  /**
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция препятствия.
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   */
  public async execute(id: string, accountId: string): Promise<ObstacleView> {
    const obstacle = await this._obstacles.getOwned(id, accountId);
    const counts = await this._counterplays.countByObstacles([obstacle.id]);
    return toObstacleView(obstacle, counts.get(obstacle.id) ?? 0);
  }
}

import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleView } from '../interfaces/obstacle-view.interface';

/** Use-case одного препятствия (`GET /accent/obstacles/:id`). Тонкий. */
@Injectable()
export class GetObstacleUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   */
  public constructor(private readonly _obstacles: AccentObstacleDomainService) {}

  /**
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция препятствия.
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   */
  public async execute(id: string, accountId: string): Promise<ObstacleView> {
    return toObstacleView(await this._obstacles.getOwned(id, accountId));
  }
}

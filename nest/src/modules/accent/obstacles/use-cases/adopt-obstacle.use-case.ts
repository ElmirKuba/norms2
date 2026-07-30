import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleView } from '../interfaces/obstacle-view.interface';

/** Use-case «Добавить себе» (`POST /accent/obstacles/:id/adopt`, ADR-0051). */
@Injectable()
export class AdoptObstacleUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   * @param _counterplays Domain-service контрмер (счётчик ответов для карточки).
   */
  public constructor(
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _counterplays: AccentCounterplayDomainService,
  ) {}

  /**
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Присвоенное препятствие (уже без бейджа «пример»).
   */
  public async execute(id: string, accountId: string): Promise<ObstacleView> {
    const adopted = await this._obstacles.adopt(id, accountId);
    const counts = await this._counterplays.countByObstacles([adopted.id]);
    return toObstacleView(adopted, counts.get(adopted.id) ?? 0, 0);
  }
}

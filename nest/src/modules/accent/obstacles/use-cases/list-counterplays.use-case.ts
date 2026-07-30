import { Injectable } from '@nestjs/common';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { AccentObstacleEncounterDomainService } from '../domain-services/accent-obstacle-encounter.domain-service';
import { toCounterplayView } from '../interfaces/counterplay-view.interface';
import type { CounterplayView } from '../interfaces/counterplay-view.interface';

/** Use-case списка контрмер препятствия (`GET /accent/obstacles/:id/counterplays`). Тонкий. */
@Injectable()
export class ListCounterplaysUseCase {
  /**
   * @param _counterplays Domain-service контрмер.
   * @param _encounters Domain-service журнала (действенность «помогало N из M»).
   */
  public constructor(
    private readonly _counterplays: AccentCounterplayDomainService,
    private readonly _encounters: AccentObstacleEncounterDomainService,
  ) {}

  /**
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Контрмеры в ручном порядке.
   */
  public async execute(obstacleId: string, accountId: string): Promise<CounterplayView[]> {
    const items = await this._counterplays.list(obstacleId, accountId);
    const stats = await this._encounters.effectiveness(obstacleId);
    const byId = new Map(stats.map((s) => [s.counterplayId, s]));
    // Порядок остаётся ручным: действенность — подсказка, а не критерий сортировки (ADR-0062 п.7).
    return items.map((c) => {
      const stat = byId.get(c.id);
      return toCounterplayView(c, stat?.helpedCount ?? 0, stat?.ratedCount ?? 0);
    });
  }
}

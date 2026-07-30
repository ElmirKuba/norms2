import { Injectable } from '@nestjs/common';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { toCounterplayView } from '../interfaces/counterplay-view.interface';
import type { CounterplayView } from '../interfaces/counterplay-view.interface';

/** Use-case списка контрмер препятствия (`GET /accent/obstacles/:id/counterplays`). Тонкий. */
@Injectable()
export class ListCounterplaysUseCase {
  /**
   * @param _counterplays Domain-service контрмер.
   */
  public constructor(private readonly _counterplays: AccentCounterplayDomainService) {}

  /**
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Контрмеры в ручном порядке.
   */
  public async execute(obstacleId: string, accountId: string): Promise<CounterplayView[]> {
    const items = await this._counterplays.list(obstacleId, accountId);
    return items.map(toCounterplayView);
  }
}

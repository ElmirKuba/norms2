import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';

/** Use-case очистки непринятых примеров (`DELETE /accent/obstacles/starter-pack`). */
@Injectable()
export class ClearObstacleStartersUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   */
  public constructor(private readonly _obstacles: AccentObstacleDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Сколько примеров удалено (присвоенные не трогаются).
   */
  public async execute(accountId: string): Promise<number> {
    return this._obstacles.clearStarters(accountId);
  }
}

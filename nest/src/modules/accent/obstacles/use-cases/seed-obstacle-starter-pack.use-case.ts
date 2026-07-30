import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';

/** Use-case сева примеров (`POST /accent/obstacles/starter-pack`, ADR-0051). Идемпотентный. */
@Injectable()
export class SeedObstacleStarterPackUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   */
  public constructor(private readonly _obstacles: AccentObstacleDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Сколько примеров засеяно (0 — все уже были).
   */
  public async execute(accountId: string): Promise<number> {
    return this._obstacles.seedStarterPack(accountId);
  }
}

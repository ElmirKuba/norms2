import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleView } from '../interfaces/obstacle-view.interface';
import type { CreateObstacleDto } from '../dtos/create-obstacle.dto';

/** Use-case создания препятствия (`POST /accent/obstacles`). Тонкий. */
@Injectable()
export class CreateObstacleUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   */
  public constructor(private readonly _obstacles: AccentObstacleDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело создания.
   * @returns Проекция созданного препятствия.
   */
  public async execute(accountId: string, dto: CreateObstacleDto): Promise<ObstacleView> {
    const created = await this._obstacles.create({
      accountId,
      name: dto.name,
      type: dto.type,
      domainKey: dto.domainKey ?? null,
      trigger: dto.trigger ?? null,
      symptoms: dto.symptoms ?? null,
      ...(dto.intensity === undefined ? {} : { intensity: dto.intensity }),
    });
    return toObstacleView(created);
  }
}

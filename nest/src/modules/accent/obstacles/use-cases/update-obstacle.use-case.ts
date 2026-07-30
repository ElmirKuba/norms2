import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleView } from '../interfaces/obstacle-view.interface';
import type { UpdateObstacleDto } from '../dtos/update-obstacle.dto';

/** Use-case правки препятствия (`PATCH /accent/obstacles/:id`). Тонкий. */
@Injectable()
export class UpdateObstacleUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   */
  public constructor(private readonly _obstacles: AccentObstacleDomainService) {}

  /**
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Поля для обновления (правка примера присваивает его — ADR-0051).
   * @returns Проекция обновлённого препятствия.
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   */
  public async execute(
    id: string,
    accountId: string,
    dto: UpdateObstacleDto,
  ): Promise<ObstacleView> {
    return toObstacleView(await this._obstacles.update(id, accountId, dto));
  }
}

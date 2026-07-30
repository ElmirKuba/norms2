import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';

/**
 * Use-case удаления препятствия (`DELETE /accent/obstacles/:id`). Полное удаление с каскадом
 * контрмер и журнала; мягкий путь — архив (`PATCH { isActive: false }`).
 */
@Injectable()
export class DeleteObstacleUseCase {
  /**
   * @param _obstacles Domain-service препятствий.
   */
  public constructor(private readonly _obstacles: AccentObstacleDomainService) {}

  /**
   * @param id Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @throws {ObstacleNotFoundError} Если нет / не ваше.
   */
  public async execute(id: string, accountId: string): Promise<void> {
    await this._obstacles.remove(id, accountId);
  }
}

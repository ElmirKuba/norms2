import { Injectable } from '@nestjs/common';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleView } from '../interfaces/obstacle-view.interface';

/**
 * Архив и возврат из него (`POST …/:id/archive` и `/restore`, 2.9.3·18).
 *
 * **Оба перехода — один use-case намеренно.** Архив это одно состояние с двумя дверями; пока
 * они в одном файле, нельзя сделать вход, забыв про выход. До 2.9.3 было ровно наоборот:
 * «убрать из списка» существовало, вернуть — нечем
 * ([ADR-0068](../../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 */
@Injectable()
export class SetObstacleArchivedUseCase {
  /**
   * @param _service Domain-service области.
   */
  public constructor(private readonly _service: AccentObstacleDomainService) {}

  /**
   * @param id Идентификатор.
   * @param accountId Владелец (из Guard).
   * @param archived `true` — в архив, `false` — вернуть в работу.
   * @returns Проекция после перехода.
   */
  public async execute(id: string, accountId: string, archived: boolean): Promise<ObstacleView> {
    const updated = await this._service.setArchived(id, accountId, archived);
    return toObstacleView(updated);
  }
}

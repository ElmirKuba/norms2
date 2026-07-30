import { Injectable } from '@nestjs/common';
import { AccentObstacleEncounterDomainService } from '../domain-services/accent-obstacle-encounter.domain-service';
import { toEncounterView } from '../interfaces/obstacle-encounter-view.interface';
import type { ObstacleEncounterView } from '../interfaces/obstacle-encounter-view.interface';
import type { SetEncounterOutcomeDto } from '../dtos/set-encounter-outcome.dto';

/**
 * Use-case «Помогло?» задним числом (`PATCH /accent/obstacles/:id/encounters/:eid`).
 * Отвечать необязательно — но если человек ответил, ответ попадёт в «помогало N из M».
 */
@Injectable()
export class SetEncounterOutcomeUseCase {
  /**
   * @param _encounters Domain-service журнала.
   */
  public constructor(private readonly _encounters: AccentObstacleEncounterDomainService) {}

  /**
   * @param id Идентификатор записи.
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Исход.
   * @returns Обновлённая запись.
   */
  public async execute(
    id: string,
    obstacleId: string,
    accountId: string,
    dto: SetEncounterOutcomeDto,
  ): Promise<ObstacleEncounterView> {
    return toEncounterView(
      await this._encounters.setOutcome(id, obstacleId, accountId, dto.outcome),
    );
  }
}

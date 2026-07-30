import { Injectable } from '@nestjs/common';
import { AccentObstacleEncounterDomainService } from '../domain-services/accent-obstacle-encounter.domain-service';
import { AccentObstacleDomainService } from '../domain-services/accent-obstacle.domain-service';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { toEncounterView } from '../interfaces/obstacle-encounter-view.interface';
import type { ObstacleEncounterView } from '../interfaces/obstacle-encounter-view.interface';
import { toObstacleView } from '../interfaces/obstacle-view.interface';
import type { ObstacleView } from '../interfaces/obstacle-view.interface';
import type { CreateEncounterDto } from '../dtos/create-encounter.dto';

/** Результат «Столкнулся»: запись + свежая карточка (фронт обновит счётчик без перезапроса). */
export interface EncounterRecordResult {
  /** Записанное столкновение. */
  encounter: ObstacleEncounterView;
  /** Препятствие с пересчитанными на чтение агрегатами. */
  obstacle: ObstacleView;
}

/**
 * Use-case «Столкнулся» (`POST /accent/obstacles/:id/encounters`) — главный поток раздела.
 * Возвращает и запись, и обновлённое препятствие: счётчик «мешал N раз» и число ответов
 * вычисляются на чтение, поэтому фронту иначе пришлось бы делать второй запрос ради цифры.
 */
@Injectable()
export class RecordEncounterUseCase {
  /**
   * @param _encounters Domain-service журнала.
   * @param _obstacles Domain-service препятствий.
   * @param _counterplays Domain-service контрмер (счётчик ответов для карточки).
   */
  public constructor(
    private readonly _encounters: AccentObstacleEncounterDomainService,
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _counterplays: AccentCounterplayDomainService,
  ) {}

  /**
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело записи (всё опционально).
   * @returns Запись и свежая карточка препятствия.
   */
  public async execute(
    obstacleId: string,
    accountId: string,
    dto: CreateEncounterDto,
  ): Promise<EncounterRecordResult> {
    const encounter = await this._encounters.record({
      obstacleId,
      accountId,
      counterplayId: dto.counterplayId ?? null,
      outcome: dto.outcome ?? null,
      note: dto.note ?? null,
      occurredAt: dto.occurredAt ?? null,
    });
    const obstacle = await this._obstacles.getOwned(obstacleId, accountId);
    const [counts, encounters] = await Promise.all([
      this._counterplays.countByObstacles([obstacleId]),
      this._encounters.countsLast30([obstacleId]),
    ]);
    return {
      encounter: toEncounterView(encounter),
      obstacle: toObstacleView(
        obstacle,
        counts.get(obstacleId) ?? 0,
        encounters.get(obstacleId) ?? 0,
      ),
    };
  }
}

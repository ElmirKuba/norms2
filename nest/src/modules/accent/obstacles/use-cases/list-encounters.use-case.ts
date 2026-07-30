import { Injectable } from '@nestjs/common';
import { AccentObstacleEncounterDomainService } from '../domain-services/accent-obstacle-encounter.domain-service';
import { toEncounterView } from '../interfaces/obstacle-encounter-view.interface';
import type { ObstacleEncounterPage } from '../interfaces/obstacle-encounter-view.interface';
import { decodeEncounterCursor, encodeEncounterCursor } from './encounter-cursor.util';

/** Размер страницы ленты по умолчанию и максимум (как у истории «держусь»). */
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

/** Use-case ленты столкновений (`GET /accent/obstacles/:id/encounters?cursor=&limit=`). */
@Injectable()
export class ListEncountersUseCase {
  /**
   * @param _encounters Domain-service журнала.
   */
  public constructor(private readonly _encounters: AccentObstacleEncounterDomainService) {}

  /**
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param rawLimit Запрошенный размер страницы (строкой из query).
   * @param rawCursor Курсор из query.
   * @returns Страница ленты (новые→старые) + курсор следующей.
   */
  public async execute(
    obstacleId: string,
    accountId: string,
    rawLimit: string | undefined,
    rawCursor: string | undefined,
  ): Promise<ObstacleEncounterPage> {
    const parsed = Number(rawLimit);
    const limit =
      Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
    const cursor = decodeEncounterCursor(rawCursor);
    const rows = await this._encounters.list(obstacleId, accountId, limit, cursor);
    // Домен тянет limit+1: лишняя строка означает «есть следующая страница».
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return {
      items: page.map(toEncounterView),
      nextCursor:
        hasMore && last ? encodeEncounterCursor({ occurredAt: last.occurredAt, id: last.id }) : null,
    };
  }
}

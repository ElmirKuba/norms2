import { Injectable } from '@nestjs/common';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { toCounterplayView } from '../interfaces/counterplay-view.interface';
import type { CounterplayView } from '../interfaces/counterplay-view.interface';
import type { UpdateCounterplayDto } from '../dtos/update-counterplay.dto';

/** Use-case правки контрмеры (`PATCH /accent/obstacles/:id/counterplays/:cid`). Тонкий. */
@Injectable()
export class UpdateCounterplayUseCase {
  /**
   * @param _counterplays Domain-service контрмер.
   */
  public constructor(private readonly _counterplays: AccentCounterplayDomainService) {}

  /**
   * @param id Идентификатор контрмеры.
   * @param obstacleId Идентификатор препятствия-родителя.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Поля для обновления.
   * @returns Обновлённая контрмера.
   */
  public async execute(
    id: string,
    obstacleId: string,
    accountId: string,
    dto: UpdateCounterplayDto,
  ): Promise<CounterplayView> {
    return toCounterplayView(await this._counterplays.update(id, obstacleId, accountId, dto));
  }
}

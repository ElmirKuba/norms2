import { Injectable } from '@nestjs/common';
import { AccentCounterplayDomainService } from '../domain-services/accent-counterplay.domain-service';
import { toCounterplayView } from '../interfaces/counterplay-view.interface';
import type { CounterplayView } from '../interfaces/counterplay-view.interface';
import type { CreateCounterplayDto } from '../dtos/create-counterplay.dto';

/** Use-case добавления контрмеры (`POST /accent/obstacles/:id/counterplays`). Тонкий. */
@Injectable()
export class CreateCounterplayUseCase {
  /**
   * @param _counterplays Domain-service контрмер.
   */
  public constructor(private readonly _counterplays: AccentCounterplayDomainService) {}

  /**
   * @param obstacleId Идентификатор препятствия.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело создания.
   * @returns Созданная контрмера.
   */
  public async execute(
    obstacleId: string,
    accountId: string,
    dto: CreateCounterplayDto,
  ): Promise<CounterplayView> {
    const created = await this._counterplays.create({
      obstacleId,
      accountId,
      text: dto.text,
      linkedMicroWinId: dto.linkedMicroWinId ?? null,
    });
    return toCounterplayView(created);
  }
}

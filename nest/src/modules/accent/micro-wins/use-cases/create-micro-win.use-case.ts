import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';
import { toMicroWinView } from '../interfaces/micro-win-view.interface';
import type { MicroWinView } from '../interfaces/micro-win-view.interface';
import type { CreateMicroWinDto } from '../dtos/create-micro-win.dto';

/**
 * Use-case создания микро-победы (`POST /accent/micro-wins`). Тонкий: собирает
 * данные создания из тела + аккаунта, domain валидирует и создаёт.
 */
@Injectable()
export class CreateMicroWinUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело создания.
   * @returns Проекция созданной микро-победы.
   */
  public async execute(accountId: string, dto: CreateMicroWinDto): Promise<MicroWinView> {
    const created = await this._microWins.create({
      accountId,
      title: dto.title,
      category: dto.category,
      durationSeconds: dto.durationSeconds,
      energyCost: dto.energyCost,
      effect: dto.effect ?? null,
      disabledForStates: dto.disabledForStates ?? null,
    });
    return toMicroWinView(created, false);
  }
}

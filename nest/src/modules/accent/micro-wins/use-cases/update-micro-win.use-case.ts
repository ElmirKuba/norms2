import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';
import { toMicroWinView } from '../interfaces/micro-win-view.interface';
import type { MicroWinView } from '../interfaces/micro-win-view.interface';
import type { UpdateMicroWinDto } from '../dtos/update-micro-win.dto';

/**
 * Use-case обновления микро-победы (`PATCH /accent/micro-wins/:id`). Тонкий:
 * domain валидирует переданные поля, проверяет владение и обновляет.
 */
@Injectable()
export class UpdateMicroWinUseCase {
  /**
   * @param _microWins Domain-service микро-побед.
   */
  public constructor(private readonly _microWins: AccentMicroWinDomainService) {}

  /**
   * @param id Идентификатор микро-победы.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Поля для обновления.
   * @returns Проекция обновлённой микро-победы.
   */
  public async execute(id: string, accountId: string, dto: UpdateMicroWinDto): Promise<MicroWinView> {
    const updated = await this._microWins.update(id, accountId, dto);
    return toMicroWinView(updated, false);
  }
}

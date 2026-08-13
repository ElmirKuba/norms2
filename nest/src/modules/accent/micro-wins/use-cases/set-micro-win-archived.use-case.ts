import { Injectable } from '@nestjs/common';
import { AccentMicroWinDomainService } from '../domain-services/accent-micro-win.domain-service';
import { toMicroWinView } from '../interfaces/micro-win-view.interface';
import type { MicroWinView } from '../interfaces/micro-win-view.interface';

/**
 * Архив и возврат из него (`POST …/:id/archive` и `/restore`, 2.9.3·18).
 *
 * **Оба перехода — один use-case намеренно.** Архив это одно состояние с двумя дверями; пока
 * они в одном файле, нельзя сделать вход, забыв про выход. До 2.9.3 было ровно наоборот:
 * «убрать из списка» существовало, вернуть — нечем
 * ([ADR-0068](../../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 */
@Injectable()
export class SetMicroWinArchivedUseCase {
  /**
   * @param _service Domain-service области.
   */
  public constructor(private readonly _service: AccentMicroWinDomainService) {}

  /**
   * @param id Идентификатор.
   * @param accountId Владелец (из Guard).
   * @param archived `true` — в архив, `false` — вернуть в работу.
   * @returns Проекция после перехода.
   */
  public async execute(id: string, accountId: string, archived: boolean): Promise<MicroWinView> {
    const updated = await this._service.setArchived(id, accountId, archived);
    // «Выполнена сегодня» тут заведомо неактуальна: карточка уезжает в архив или возвращается
    // из него, и день ей пересчитает ближайший список.
    return toMicroWinView(updated, false);
  }
}

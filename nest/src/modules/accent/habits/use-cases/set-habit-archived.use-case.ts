import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';

/**
 * Архив и возврат из него (`POST …/:id/archive` и `/restore`, 2.9.3·18).
 *
 * **Оба перехода — один use-case намеренно.** Архив это одно состояние с двумя дверями; пока
 * они в одном файле, нельзя сделать вход, забыв про выход. До 2.9.3 было ровно наоборот:
 * «убрать из списка» существовало, вернуть — нечем
 * ([ADR-0068](../../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 */
@Injectable()
export class SetHabitArchivedUseCase {
  /**
   * @param _service Domain-service области.
   */
  public constructor(private readonly _service: AccentHabitDomainService) {}

  /**
   * @param id Идентификатор.
   * @param accountId Владелец (из Guard).
   * @param archived `true` — в архив, `false` — вернуть в работу.
   * @returns Проекция после перехода.
   */
  public async execute(id: string, accountId: string, archived: boolean): Promise<HabitView> {
    const updated = await this._service.setArchived(id, accountId, archived);
    return toHabitView(updated);
  }
}

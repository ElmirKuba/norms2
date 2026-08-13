import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';

/**
 * Архив и возврат из него (`POST /accent/anti-habits/:id/archive` и `/restore`, 2.9.3·18).
 *
 * **Один use-case на оба перехода намеренно.** Архив — это одно состояние с двумя дверями, и
 * пока двери живут в одном файле, невозможно сделать вход, забыв про выход. Ровно это и
 * случилось до 2.9.3: «убрать из списка» было, вернуть — нечем.
 */
@Injectable()
export class SetAntiHabitArchivedUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор.
   * @param accountId Владелец (из Guard).
   * @param archived `true` — в архив, `false` — вернуть в работу.
   * @returns Проекция анти-привычки после перехода.
   */
  public async execute(id: string, accountId: string, archived: boolean): Promise<AntiHabitView> {
    const updated = await this._antiHabits.setArchived(id, accountId, archived);
    return toAntiHabitView(updated);
  }
}

import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';

/**
 * Удаление анти-привычки (`DELETE /accent/anti-habits/:id`, 2.9.3·18).
 *
 * До 2.9.3 удаления не было вовсе: единственным способом убрать анти-привычку был архив, из
 * которого не было выхода. Теперь у человека есть оба честных пути — спрятать и удалить, и
 * второй **безвозвратен** ([ADR-0068](../../../../../docs/decisions/0068-deletion-belongs-to-storage.md)).
 */
@Injectable()
export class DeleteAntiHabitUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор.
   * @param accountId Владелец (из Guard).
   * @returns Промис завершения.
   */
  public async execute(id: string, accountId: string): Promise<void> {
    await this._antiHabits.delete(id, accountId);
  }
}

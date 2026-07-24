import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import { toAntiHabitEventView } from '../interfaces/anti-habit-event-view.interface';
import type { RelapseResultView } from './relapse-anti-habit.use-case';
import type { RescheduleDto } from '../dtos/reschedule.dto';

/**
 * Use-case переноса старта в будущее (`POST /accent/anti-habits/:id/reschedule`, ADR-0059).
 * Тонкий: domain завершает текущую попытку под CAS, пишет событие `reschedule`, старт → `planned`.
 */
@Injectable()
export class RescheduleAntiHabitUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Новый старт (unix ms, в будущем).
   * @returns Обновлённая анти-привычка + событие `reschedule`.
   */
  public async execute(
    id: string,
    accountId: string,
    dto: RescheduleDto,
  ): Promise<RelapseResultView> {
    const result = await this._antiHabits.reschedule(id, accountId, dto.startAt);
    return {
      antiHabit: toAntiHabitView(result.antiHabit),
      event: toAntiHabitEventView(result.event),
    };
  }
}

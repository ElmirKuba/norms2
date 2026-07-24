import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';
import { toAntiHabitEventView } from '../interfaces/anti-habit-event-view.interface';
import type { AntiHabitEventView } from '../interfaces/anti-habit-event-view.interface';
import type { RelapseDto } from '../dtos/relapse.dto';

/**
 * Результат срыва наружу: обновлённая анти-привычка (после сброса) + записанное событие
 * (чтобы фронт обновил карточку и добавил запись в историю без перезапроса).
 */
export interface RelapseResultView {
  /** Анти-привычка после сброса. */
  antiHabit: AntiHabitView;
  /** Записанное событие таймлайна. */
  event: AntiHabitEventView;
}

/**
 * Use-case рецидива (`POST /accent/anti-habits/:id/relapse`). Тонкий: domain делает CAS-сброс
 * попытки, обновляет рекорд, пишет событие `relapse` и эмитит хук; use-case проецирует наружу.
 */
@Injectable()
export class RelapseAntiHabitUseCase {
  /**
   * @param _antiHabits Domain-service анти-привычек.
   */
  public constructor(private readonly _antiHabits: AccentAntiHabitDomainService) {}

  /**
   * @param id Идентификатор анти-привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Опц. триггер/заметка.
   * @returns Обновлённая анти-привычка + записанное событие.
   */
  public async execute(
    id: string,
    accountId: string,
    dto: RelapseDto,
  ): Promise<RelapseResultView> {
    const result = await this._antiHabits.relapse(id, accountId, {
      triggerTag: dto.triggerTag ?? null,
      note: dto.note ?? null,
    });
    return {
      antiHabit: toAntiHabitView(result.antiHabit),
      event: toAntiHabitEventView(result.event),
    };
  }
}

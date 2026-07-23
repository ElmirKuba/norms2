import { Injectable } from '@nestjs/common';
import { AccentAntiHabitDomainService } from '../domain-services/accent-anti-habit.domain-service';
import { toAntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';
import { toAntiHabitRelapseView } from '../interfaces/anti-habit-relapse-view.interface';
import type { AntiHabitRelapseView } from '../interfaces/anti-habit-relapse-view.interface';
import type { RelapseDto } from '../dtos/relapse.dto';

/**
 * Результат срыва наружу: обновлённая анти-привычка (после сброса таймера/рекорда) +
 * записанный рецидив (чтобы фронт обновил карточку и добавил запись в историю без перезапроса).
 */
export interface RelapseResultView {
  /** Анти-привычка после сброса. */
  antiHabit: AntiHabitView;
  /** Записанный рецидив. */
  relapse: AntiHabitRelapseView;
}

/**
 * Use-case рецидива (`POST /accent/anti-habits/:id/relapse`). Тонкий: domain делает CAS-сброс
 * попытки, обновляет рекорд, пишет рецидив и эмитит хук; use-case только проецирует наружу.
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
   * @returns Обновлённая анти-привычка + записанный рецидив.
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
      relapse: toAntiHabitRelapseView(result.relapse),
    };
  }
}

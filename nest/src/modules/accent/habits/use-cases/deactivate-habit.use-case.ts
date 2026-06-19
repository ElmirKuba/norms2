import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';

/**
 * Use-case деактивации привычки (`POST /accent/habits/:id/deactivate`). Оркестрирует две
 * области (без круговой DI между domain-service'ами): domain привычек мягко гасит
 * (`isActive=false` → уходит из материализации), затем domain задач убирает ещё не
 * тронутые (`pending`) задачи этой привычки. Удаление шаблона намеренное (кнопка +
 * подтверждение модалкой), потому незакрытые дела тоже убираем; выполненные/частичные/
 * пропущенные остаются ради истории.
 */
@Injectable()
export class DeactivateHabitUseCase {
  /**
   * @param _habits Domain-service привычек.
   * @param _tasks Domain-service задач (удаление pending при деактивации).
   */
  public constructor(
    private readonly _habits: AccentHabitDomainService,
    private readonly _tasks: AccentTaskDomainService,
  ) {}

  /**
   * @param id Идентификатор привычки.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция деактивированной привычки.
   */
  public async execute(id: string, accountId: string): Promise<HabitView> {
    const habit = await this._habits.deactivate(id, accountId);
    await this._tasks.removePendingForTemplate(id, accountId);
    return toHabitView(habit);
  }
}

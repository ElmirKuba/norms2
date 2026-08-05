import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toHabitView } from '../interfaces/habit-view.interface';
import type { HabitView } from '../interfaces/habit-view.interface';

/**
 * Use-case деактивации привычки (`POST /accent/habits/:id/deactivate`). Оркестрирует две
 * области (без круговой DI между domain-service'ами): domain привычек мягко гасит
 * (`isActive=false` → уходит из материализации), затем domain задач убирает **незакрытые
 * дела** этой привычки: `pending` любой даты и переносы за сегодня и позже. Удаление шаблона
 * намеренное (кнопка + подтверждение модалкой), потому незакрытые дела тоже убираем;
 * выполненные, частичные и **прошлые** пропуски остаются ради истории.
 *
 * **Почему перенос считается незакрытым делом, а не историей** (поймано живым пользователем
 * 05.08.2026): у перенесённой задачи живая кнопка «Вернуть на сегодня». Оставь её — и человек
 * вернёт в работу задачу шаблона, которого в списке уже нет.
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
   * @param timezone IANA-таймзона аккаунта (из Guard) — граница «сегодня и позже» для переносов.
   * @returns Проекция деактивированной привычки.
   */
  public async execute(id: string, accountId: string, timezone: string): Promise<HabitView> {
    const habit = await this._habits.deactivate(id, accountId);
    // «Сегодня» считается здесь: домен о таймзонах не знает (как в unpostpone).
    await this._tasks.removeOpenForTemplate(id, accountId, todayInTimezone(timezone));
    return toHabitView(habit);
  }
}

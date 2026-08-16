import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { AccentGoalDomainService } from '../../goals/domain-services/accent-goal.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { CompleteTaskResult } from '../interfaces/task-view.interface';

/**
 * Use-case выполнения задачи (`POST /accent/tasks/:id/complete`). Точка **кросс-домена ВНИЗ**
 * (ADR-0050, 2.5·13): на реальном переходе complete у задачи с привязкой к цели (`goalId`)
 * докидывает прогресс в цель через `AccentGoalDomainService` (best-effort). Идемпотентно —
 * только когда `transitioned` (один раз на переход; повтор/гонка не двоят).
 */
@Injectable()
export class CompleteTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   * @param _goals Domain-service целей (кросс-домен вниз).
   */
  public constructor(
    private readonly _tasks: AccentTaskDomainService,
    private readonly _goals: AccentGoalDomainService,
  ) {}

  /**
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone TZ пользователя (дата записи прогресса цели).
   * @param doneValue Сколько сделано (опц.).
   * @param replace Явное намерение понизить уже записанный результат (опц., 2.7.1).
   * @returns Проекция обновлённой задачи + событие лесенки.
   */
  public async execute(
    id: string,
    accountId: string,
    timezone: string,
    doneValue?: number,
    replace?: boolean,
  ): Promise<CompleteTaskResult> {
    // Прошлое только для чтения (2.10·B1): отметить вчерашний день нельзя.
    //
    // Найдено прогоном ·B5: снятие отметки было защищено, а простановка — нет, то есть правило
    // выполнялось наполовину. Разница важна по существу: разрешив отмечать задним числом, мы
    // превращаем «дней подряд» из свидетельства в отчёт о намерениях — ровно то, ради чего
    // read-only и выбиралось (реш. Elmir 14.08.2026: «это не свободная эксель-таблица»).
    const existing = await this._tasks.findOwned(id, accountId);
    if (existing !== null && existing.occurredOn !== todayInTimezone(timezone)) {
      throw new ValidationError('Отмечать можно только сегодняшний день.');
    }

    const { task, ladderEvent, transitioned } = await this._tasks.complete(
      id,
      accountId,
      doneValue,
      replace,
    );
    // Кросс-домен вниз: прогресс цели только на реальном переходе и при привязке к цели.
    if (transitioned && task.goalId !== null && task.doneValue !== null) {
      await this._goals.addProgressFromHabit(
        task.goalId,
        accountId,
        task.doneValue,
        task.id,
        timezone,
      );
    }
    return { task: toTaskView(task), ladderEvent };
  }
}

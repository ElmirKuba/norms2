import { Injectable } from '@nestjs/common';
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
   * @returns Проекция обновлённой задачи + событие лесенки.
   */
  public async execute(
    id: string,
    accountId: string,
    timezone: string,
    doneValue?: number,
  ): Promise<CompleteTaskResult> {
    const { task, ladderEvent, transitioned } = await this._tasks.complete(
      id,
      accountId,
      doneValue,
    );
    // Кросс-домен вниз: прогресс цели только на реальном переходе и при привязке к цели.
    if (transitioned && task.goalId !== null && task.doneValue !== null) {
      await this._goals.addProgressFromHabit(task.goalId, accountId, task.doneValue, timezone);
    }
    return { task: toTaskView(task), ladderEvent };
  }
}

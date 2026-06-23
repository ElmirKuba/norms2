import { Injectable } from '@nestjs/common';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { AccentGoalDomainService } from '../../goals/domain-services/accent-goal.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/**
 * Use-case снятия отметки выполнения (`POST /accent/tasks/:id/uncomplete`). Кросс-домен вниз
 * (2.5·23 P2): если задача привязана к цели — **откатывает** прогресс цели, порождённый этой
 * задачей (по `sourceTaskId`), чтобы «отметил→снял→отметил» не двоил прогресс. Best-effort.
 */
@Injectable()
export class UncompleteTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   * @param _goals Domain-service целей (откат прогресса).
   */
  public constructor(
    private readonly _tasks: AccentTaskDomainService,
    private readonly _goals: AccentGoalDomainService,
  ) {}

  /**
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция обновлённой задачи.
   */
  public async execute(id: string, accountId: string): Promise<TaskView> {
    const task = await this._tasks.uncomplete(id, accountId);
    if (task.goalId !== null) {
      await this._goals.revokeProgressFromHabit(task.goalId, accountId, task.id);
    }
    return toTaskView(task);
  }
}

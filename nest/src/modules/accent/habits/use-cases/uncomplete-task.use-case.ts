import { Injectable } from '@nestjs/common';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/** Use-case снятия отметки выполнения (`POST /accent/tasks/:id/uncomplete`). */
@Injectable()
export class UncompleteTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция обновлённой задачи.
   */
  public async execute(id: string, accountId: string): Promise<TaskView> {
    return toTaskView(await this._tasks.uncomplete(id, accountId));
  }
}

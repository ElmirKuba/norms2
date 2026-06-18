import { Injectable } from '@nestjs/common';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/** Use-case выполнения задачи (`POST /accent/tasks/:id/complete`). */
@Injectable()
export class CompleteTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param doneValue Сколько сделано (опц.).
   * @returns Проекция обновлённой задачи.
   */
  public async execute(id: string, accountId: string, doneValue?: number): Promise<TaskView> {
    return toTaskView(await this._tasks.complete(id, accountId, doneValue));
  }
}

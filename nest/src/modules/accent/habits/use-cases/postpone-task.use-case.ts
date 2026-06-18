import { Injectable } from '@nestjs/common';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/** Use-case переноса задачи на завтра (`POST /accent/tasks/:id/postpone`). */
@Injectable()
export class PostponeTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция новой (завтрашней) задачи.
   */
  public async execute(id: string, accountId: string): Promise<TaskView> {
    return toTaskView(await this._tasks.postpone(id, accountId));
  }
}

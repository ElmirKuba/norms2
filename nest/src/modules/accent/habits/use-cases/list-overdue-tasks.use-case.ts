import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/** Use-case просроченных разовых задач (`GET /accent/tasks/overdue`). */
@Injectable()
export class ListOverdueTasksUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @returns Проекции просроченных задач.
   */
  public async execute(accountId: string, timezone: string): Promise<TaskView[]> {
    const items = await this._tasks.listOverdue(accountId, todayInTimezone(timezone), timezone);
    return items.map((item) => toTaskView(item));
  }
}

import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/** Use-case разовых задач с дедлайном сегодня (`GET /accent/tasks/due-today`). */
@Injectable()
export class ListDueTodayTasksUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @returns Проекции задач с дедлайном сегодня.
   */
  public async execute(accountId: string, timezone: string): Promise<TaskView[]> {
    const items = await this._tasks.listDueToday(accountId, todayInTimezone(timezone), timezone);
    return items.map((item) => toTaskView(item));
  }
}

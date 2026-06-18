import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/**
 * Use-case задач дня (`GET /accent/tasks?date=YYYY-MM-DD`). Тонкий: domain материализует
 * из привычек + возвращает список; без date — сегодня в TZ аккаунта.
 */
@Injectable()
export class ListTasksUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @param date Дата `YYYY-MM-DD` (опц.; по умолчанию — сегодня).
   * @returns Проекции задач дня.
   */
  public async execute(accountId: string, timezone: string, date?: string): Promise<TaskView[]> {
    const day = date ?? todayInTimezone(timezone);
    const items = await this._tasks.listForDay(accountId, day, timezone);
    return items.map((item) => toTaskView(item));
  }
}

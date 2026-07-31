import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';

/**
 * Use-case возврата перенесённой задачи на сегодня (`POST /accent/tasks/:id/unpostpone`, 2.7.2).
 * «Сегодня» считается по таймзоне аккаунта здесь — домен о таймзонах не знает.
 */
@Injectable()
export class UnpostponeTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @returns Проекция вернувшейся в работу задачи.
   */
  public async execute(id: string, accountId: string, timezone: string): Promise<TaskView> {
    return toTaskView(await this._tasks.unpostpone(id, accountId, todayInTimezone(timezone)));
  }
}

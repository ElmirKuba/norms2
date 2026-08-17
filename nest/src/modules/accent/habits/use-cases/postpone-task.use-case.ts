import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { ValidationError } from '../../../../shared/errors/validation.error';
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
   * @param timezone IANA-таймзона аккаунта (по ней считается «сегодня»).
   * @returns Проекция новой (завтрашней) задачи.
   */
  public async execute(id: string, accountId: string, timezone: string): Promise<TaskView> {
    // Прошлое — только для чтения (2.10·B1). Проверка нужна именно здесь: `postpone` считает
    // «завтра» от дня самой задачи, поэтому перенос из 7 августа создал бы задачу на 8 августа —
    // тоже в прошлом, да ещё и закрыл бы исходную. Экран кнопку прячет, но правило домена не
    // должно держаться на вёрстке.
    const task = await this._tasks.getOwned(id, accountId);
    if (task.occurredOn !== todayInTimezone(timezone)) {
      throw new ValidationError('Переносить можно только сегодняшний день.');
    }
    return toTaskView(await this._tasks.postpone(id, accountId));
  }
}

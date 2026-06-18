import { Injectable } from '@nestjs/common';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskView } from '../interfaces/task-view.interface';
import type { CreateOneOffTaskDto } from '../dtos/create-one-off-task.dto';

/**
 * Use-case создания разовой задачи (`POST /accent/tasks`). Тонкий: собирает данные из
 * тела + аккаунта (deadline ISO → Date), domain валидирует и создаёт (templateId=null).
 */
@Injectable()
export class CreateOneOffTaskUseCase {
  /**
   * @param _tasks Domain-service задач.
   */
  public constructor(private readonly _tasks: AccentTaskDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело создания.
   * @returns Проекция созданной задачи.
   */
  public async execute(accountId: string, dto: CreateOneOffTaskDto): Promise<TaskView> {
    const created = await this._tasks.createOneOff({
      accountId,
      title: dto.title,
      occurredOn: dto.occurredOn,
      kind: dto.kind,
      targetValue: dto.targetValue ?? null,
      category: dto.category ?? null,
      deadline: dto.deadline === undefined || dto.deadline === null ? null : new Date(dto.deadline),
      priority: dto.priority ?? 0,
    });
    return toTaskView(created);
  }
}

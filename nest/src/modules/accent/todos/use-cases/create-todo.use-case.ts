import { Injectable } from '@nestjs/common';
import { AccentTodoDomainService } from '../domain-services/accent-todo.domain-service';
import { toTodoView } from '../interfaces/todo-view.interface';
import type { TodoView } from '../interfaces/todo-view.interface';
import type { CreateTodoDto } from '../dtos/create-todo.dto';

/**
 * Use-case создания записи (`POST /accent/todos`). Тонкий: домен проверяет правила, здесь —
 * только проекция наружу.
 */
@Injectable()
export class CreateTodoUseCase {
  /**
   * @param _todos Domain-service дел.
   */
  public constructor(private readonly _todos: AccentTodoDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело запроса.
   * @returns Проекция созданной записи.
   */
  public async execute(accountId: string, dto: CreateTodoDto): Promise<TodoView> {
    const row = await this._todos.create({
      accountId,
      kind: dto.kind,
      title: dto.title,
      parentId: dto.parentId ?? null,
      note: dto.note ?? null,
      plannedOn: dto.plannedOn ?? null,
      waitsForEventId: dto.waitsForEventId ?? null,
      waitsUntil: dto.waitsUntil ?? null,
      badge: dto.badge ?? null,
    });
    return toTodoView(row);
  }
}

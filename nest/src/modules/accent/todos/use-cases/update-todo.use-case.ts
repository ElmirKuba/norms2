import { Injectable } from '@nestjs/common';
import { AccentTodoDomainService } from '../domain-services/accent-todo.domain-service';
import { toTodoView } from '../interfaces/todo-view.interface';
import type { TodoView } from '../interfaces/todo-view.interface';
import type { UpdateTodoDto } from '../dtos/create-todo.dto';

/**
 * Use-case правки записи (`PATCH /accent/todos/:id`). Патч частичный: приходят только те поля,
 * которые человек менял, — остальные не трогаются.
 */
@Injectable()
export class UpdateTodoUseCase {
  /**
   * @param _todos Domain-service дел.
   */
  public constructor(private readonly _todos: AccentTodoDomainService) {}

  /**
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Изменяемые поля.
   * @returns Проекция обновлённой записи.
   */
  public async execute(id: string, accountId: string, dto: UpdateTodoDto): Promise<TodoView> {
    const row = await this._todos.update(id, accountId, dto);
    return toTodoView(row);
  }
}

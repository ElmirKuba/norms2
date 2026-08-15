import { Injectable } from '@nestjs/common';
import { AccentTodoDomainService } from '../domain-services/accent-todo.domain-service';
import { toTodoView } from '../interfaces/todo-view.interface';
import type { TodoView } from '../interfaces/todo-view.interface';

/**
 * Use-case архивации и возврата (`POST /accent/todos/:id/archive` и `/restore`).
 *
 * Архив — не удаление: у спрятанного обязан быть экран, где его видно, и способ вернуть
 * (правило проверяется `make audit-states`).
 */
@Injectable()
export class SetTodoArchivedUseCase {
  /**
   * @param _todos Domain-service дел.
   */
  public constructor(private readonly _todos: AccentTodoDomainService) {}

  /**
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param archived `true` — в архив.
   * @returns Проекция обновлённой записи.
   */
  public async execute(id: string, accountId: string, archived: boolean): Promise<TodoView> {
    const row = await this._todos.setArchived(id, accountId, archived);
    return toTodoView(row);
  }
}

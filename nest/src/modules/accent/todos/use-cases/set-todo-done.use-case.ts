import { Injectable } from '@nestjs/common';
import { AccentTodoDomainService } from '../domain-services/accent-todo.domain-service';
import { toTodoView } from '../interfaces/todo-view.interface';
import type { TodoView } from '../interfaces/todo-view.interface';

/**
 * Use-case отметки выполнения (`POST /accent/todos/:id/complete` и `/uncomplete`).
 *
 * Снятие отметки разрешено **в любой день**, в отличие от задач привычек: у записи нет серии,
 * которую можно было бы этим исказить, а «поставил галочку не тому пункту» — обычная опечатка.
 */
@Injectable()
export class SetTodoDoneUseCase {
  /**
   * @param _todos Domain-service дел.
   */
  public constructor(private readonly _todos: AccentTodoDomainService) {}

  /**
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param done `true` — отметить выполненной.
   * @returns Проекция обновлённой записи.
   */
  public async execute(id: string, accountId: string, done: boolean): Promise<TodoView> {
    const row = await this._todos.setDone(id, accountId, done);
    return toTodoView(row);
  }
}

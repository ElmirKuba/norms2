import { Injectable } from '@nestjs/common';
import { AccentTodoDomainService } from '../domain-services/accent-todo.domain-service';

/**
 * Use-case удаления записи (`DELETE /accent/todos/:id`). Подзадачи уходят вместе с родителем —
 * каскад по карте владения, как у подцелей.
 */
@Injectable()
export class DeleteTodoUseCase {
  /**
   * @param _todos Domain-service дел.
   */
  public constructor(private readonly _todos: AccentTodoDomainService) {}

  /**
   * @param id Идентификатор записи.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Промис завершения.
   */
  public async execute(id: string, accountId: string): Promise<void> {
    await this._todos.delete(id, accountId);
  }
}

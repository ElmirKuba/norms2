import { Injectable } from '@nestjs/common';
import { AccentTodoDomainService } from '../domain-services/accent-todo.domain-service';

/**
 * Use-case перестановки (`PUT /accent/todos/reorder`). Порядок приходит списком идентификаторов —
 * так же, как в остальных списках раздела.
 */
@Injectable()
export class ReorderTodosUseCase {
  /**
   * @param _todos Domain-service дел.
   */
  public constructor(private readonly _todos: AccentTodoDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param ids Идентификаторы в новом порядке.
   * @returns Промис завершения.
   */
  public async execute(accountId: string, ids: string[]): Promise<void> {
    await this._todos.reorder(accountId, ids);
  }
}

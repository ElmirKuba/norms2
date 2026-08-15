import { Injectable } from '@nestjs/common';
import { AccentTodoDomainService } from '../domain-services/accent-todo.domain-service';
import { toTodoView } from '../interfaces/todo-view.interface';
import type { TodoView } from '../interfaces/todo-view.interface';
import type { TodoFull, TodoKind } from '../interfaces/todo-full.interface';

/**
 * Use-case списка записей (`GET /accent/todos`). Тонкий: домен отдаёт корни и подзадачи двумя
 * плоскими наборами, здесь они собираются в дерево — экран получает готовую структуру и не
 * делает запрос на каждую строку.
 */
@Injectable()
export class ListTodosUseCase {
  /**
   * @param _todos Domain-service дел.
   */
  public constructor(private readonly _todos: AccentTodoDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param kind Вид записи.
   * @param archived `true` — архив вместо живых.
   * @returns Корневые записи с вложенными подзадачами.
   */
  public async execute(accountId: string, kind: TodoKind, archived: boolean): Promise<TodoView[]> {
    const { roots, children } = await this._todos.list(accountId, kind, archived);
    const byParent = new Map<string, TodoFull[]>();
    for (const child of children) {
      if (child.parentId === null) {
        continue;
      }
      const bucket = byParent.get(child.parentId) ?? [];
      bucket.push(child);
      byParent.set(child.parentId, bucket);
    }
    return roots.map((root) => toTodoView(root, byParent.get(root.id) ?? []));
  }
}

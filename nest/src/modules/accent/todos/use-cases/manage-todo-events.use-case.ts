import { Injectable } from '@nestjs/common';
import { AccentTodoDomainService } from '../domain-services/accent-todo.domain-service';
import { toTodoEventView } from '../interfaces/todo-view.interface';
import type { TodoEventView } from '../interfaces/todo-view.interface';
import type { CreateTodoEventDto, UpdateTodoEventDto } from '../dtos/create-todo.dto';

/**
 * Use-case справочника событий (`/accent/todo-events`, 2.10·D1).
 *
 * Один use-case на весь справочник, а не пять отдельных: это словарь из четырёх полей, и
 * дробить его на файлы значило бы плодить одинаковые обёртки вокруг одной строки вызова.
 */
@Injectable()
export class ManageTodoEventsUseCase {
  /**
   * @param _todos Domain-service дел и событий.
   */
  public constructor(private readonly _todos: AccentTodoDomainService) {}

  /**
   * Список событий.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param includeHappened Включать ли состоявшиеся.
   * @returns Проекции событий.
   */
  public async list(accountId: string, includeHappened: boolean): Promise<TodoEventView[]> {
    const rows = await this._todos.listEvents(accountId, includeHappened);
    return rows.map(toTodoEventView);
  }

  /**
   * Создаёт событие.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Тело запроса.
   * @returns Проекция созданного события.
   */
  public async create(accountId: string, dto: CreateTodoEventDto): Promise<TodoEventView> {
    const row = await this._todos.createEvent({
      accountId,
      title: dto.title,
      expectedOn: dto.expectedOn ?? null,
    });
    return toTodoEventView(row);
  }

  /**
   * Правит событие.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param dto Изменяемые поля.
   * @returns Проекция обновлённого события.
   */
  public async update(
    id: string,
    accountId: string,
    dto: UpdateTodoEventDto,
  ): Promise<TodoEventView> {
    const row = await this._todos.updateEvent(id, accountId, dto);
    return toTodoEventView(row);
  }

  /**
   * Отмечает событие состоявшимся (или снимает отметку) и освобождает ждавшие дела.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param happened `true` — состоялось.
   * @returns Событие и число освобождённых дел — фронт скажет человеку, что именно разблокировалось.
   */
  public async setHappened(
    id: string,
    accountId: string,
    happened: boolean,
  ): Promise<{ event: TodoEventView; released: number }> {
    const { event, released } = await this._todos.setEventHappened(id, accountId, happened);
    return { event: toTodoEventView(event), released };
  }

  /**
   * Удаляет событие, сняв ожидание у дел.
   * @param id Идентификатор события.
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Промис завершения.
   */
  public async remove(id: string, accountId: string): Promise<void> {
    await this._todos.deleteEvent(id, accountId);
  }
}

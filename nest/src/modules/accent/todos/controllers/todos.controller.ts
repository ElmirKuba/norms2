import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { ListTodosUseCase } from '../use-cases/list-todos.use-case';
import { TODO_KINDS } from '../interfaces/todo-full.interface';
import type { TodoKind } from '../interfaces/todo-full.interface';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { TodoView } from '../interfaces/todo-view.interface';

/**
 * Контроллер списков дел (`/api/v1/accent/todos`) — под Guard, per-account. Тонкий слой:
 * controller → use-case. Все операции скоупятся по аккаунту из Guard (владение).
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class TodosController {
  /**
   * @param _list Список записей.
   */
  public constructor(private readonly _list: ListTodosUseCase) {}

  /**
   * Записи одного вида с подзадачами.
   * @param request Запрос с аккаунтом из Guard.
   * @param kind Вид записи; неизвестный трактуется как `deed` — список не место для ошибок
   *   валидации, человек просто хотел посмотреть дела.
   * @param archived `'1'` — показать архив.
   * @returns Корневые записи с вложенными подзадачами.
   */
  @Get('todos')
  public async list(
    @Req() request: AuthenticatedRequest,
    @Query('kind') kind?: string,
    @Query('archived') archived?: string,
  ): Promise<TodoView[]> {
    const safeKind: TodoKind = (TODO_KINDS as readonly string[]).includes(kind ?? '')
      ? (kind as TodoKind)
      : 'deed';
    return this._list.execute(request.account.id, safeKind, archived === '1');
  }
}

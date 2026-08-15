import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { ListTodosUseCase } from '../use-cases/list-todos.use-case';
import { CreateTodoUseCase } from '../use-cases/create-todo.use-case';
import { UpdateTodoUseCase } from '../use-cases/update-todo.use-case';
import { SetTodoDoneUseCase } from '../use-cases/set-todo-done.use-case';
import { SetTodoArchivedUseCase } from '../use-cases/set-todo-archived.use-case';
import { DeleteTodoUseCase } from '../use-cases/delete-todo.use-case';
import { createTodoSchema, updateTodoSchema } from '../dtos/create-todo.dto';
import type { CreateTodoDto, UpdateTodoDto } from '../dtos/create-todo.dto';
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
   * @param _create Создание записи.
   * @param _update Правка записи.
   * @param _setDone Отметка выполнения.
   * @param _setArchived Архивация и возврат.
   * @param _delete Удаление.
   */
  public constructor(
    private readonly _list: ListTodosUseCase,
    private readonly _create: CreateTodoUseCase,
    private readonly _update: UpdateTodoUseCase,
    private readonly _setDone: SetTodoDoneUseCase,
    private readonly _setArchived: SetTodoArchivedUseCase,
    private readonly _delete: DeleteTodoUseCase,
  ) {}

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

  /**
   * Создаёт запись. Обязателен только заголовок.
   * @param request Запрос с аккаунтом из Guard.
   * @param dto Тело запроса.
   * @returns Проекция созданной записи.
   */
  @Post('todos')
  public async create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createTodoSchema)) dto: CreateTodoDto,
  ): Promise<TodoView> {
    return this._create.execute(request.account.id, dto);
  }

  /**
   * Правит запись (частичный патч).
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор записи.
   * @param dto Изменяемые поля.
   * @returns Проекция обновлённой записи.
   */
  @Patch('todos/:id')
  public async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTodoSchema)) dto: UpdateTodoDto,
  ): Promise<TodoView> {
    return this._update.execute(id, request.account.id, dto);
  }

  /**
   * Отмечает запись выполненной.
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор записи.
   * @returns Проекция обновлённой записи.
   */
  @Post('todos/:id/complete')
  public async complete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<TodoView> {
    return this._setDone.execute(id, request.account.id, true);
  }

  /**
   * Снимает отметку выполнения.
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор записи.
   * @returns Проекция обновлённой записи.
   */
  @Post('todos/:id/uncomplete')
  public async uncomplete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<TodoView> {
    return this._setDone.execute(id, request.account.id, false);
  }

  /**
   * Отправляет запись в архив.
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор записи.
   * @returns Проекция обновлённой записи.
   */
  @Post('todos/:id/archive')
  public async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<TodoView> {
    return this._setArchived.execute(id, request.account.id, true);
  }

  /**
   * Возвращает запись из архива.
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор записи.
   * @returns Проекция обновлённой записи.
   */
  @Post('todos/:id/restore')
  public async restore(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<TodoView> {
    return this._setArchived.execute(id, request.account.id, false);
  }

  /**
   * Удаляет запись вместе с подзадачами.
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор записи.
   * @returns Пустой ответ 204.
   */
  @Delete('todos/:id')
  @HttpCode(204)
  public async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this._delete.execute(id, request.account.id);
  }
}

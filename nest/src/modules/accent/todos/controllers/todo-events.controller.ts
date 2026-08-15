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
import { ManageTodoEventsUseCase } from '../use-cases/manage-todo-events.use-case';
import { createTodoEventSchema, updateTodoEventSchema } from '../dtos/create-todo.dto';
import type { CreateTodoEventDto, UpdateTodoEventDto } from '../dtos/create-todo.dto';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { TodoEventView } from '../interfaces/todo-view.interface';

/**
 * Контроллер справочника событий (`/api/v1/accent/todo-events`, 2.10·D1) — под Guard,
 * per-account.
 *
 * Отдельный контроллер, а не ручки внутри `todos`: события живут своей жизнью (их заводят и
 * закрывают независимо от дел), и мешать словарь с записями в одном файле — верный способ
 * запутать маршруты.
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class TodoEventsController {
  /**
   * @param _events Use-case справочника.
   */
  public constructor(private readonly _events: ManageTodoEventsUseCase) {}

  /**
   * Список событий.
   * @param request Запрос с аккаунтом из Guard.
   * @param happened `'1'` — показать и состоявшиеся.
   * @returns Проекции событий.
   */
  @Get('todo-events')
  public async list(
    @Req() request: AuthenticatedRequest,
    @Query('happened') happened?: string,
  ): Promise<TodoEventView[]> {
    return this._events.list(request.account.id, happened === '1');
  }

  /**
   * Создаёт событие.
   * @param request Запрос с аккаунтом из Guard.
   * @param dto Тело запроса.
   * @returns Проекция созданного события.
   */
  @Post('todo-events')
  public async create(
    @Req() request: AuthenticatedRequest,
    @Body(new ZodValidationPipe(createTodoEventSchema)) dto: CreateTodoEventDto,
  ): Promise<TodoEventView> {
    return this._events.create(request.account.id, dto);
  }

  /**
   * Правит событие.
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор события.
   * @param dto Изменяемые поля.
   * @returns Проекция обновлённого события.
   */
  @Patch('todo-events/:id')
  public async update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTodoEventSchema)) dto: UpdateTodoEventDto,
  ): Promise<TodoEventView> {
    return this._events.update(id, request.account.id, dto);
  }

  /**
   * Отмечает событие состоявшимся и освобождает ждавшие дела.
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор события.
   * @returns Событие и число освобождённых дел.
   */
  @Post('todo-events/:id/happened')
  public async happened(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ event: TodoEventView; released: number }> {
    return this._events.setHappened(id, request.account.id, true);
  }

  /**
   * Снимает отметку «состоялось» (ошиблись — событие ещё впереди).
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор события.
   * @returns Событие и ноль освобождённых.
   */
  @Post('todo-events/:id/unhappened')
  public async unhappened(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ event: TodoEventView; released: number }> {
    return this._events.setHappened(id, request.account.id, false);
  }

  /**
   * Удаляет событие, сняв ожидание у дел.
   * @param request Запрос с аккаунтом из Guard.
   * @param id Идентификатор события.
   * @returns Пустой ответ 204.
   */
  @Delete('todo-events/:id')
  @HttpCode(204)
  public async remove(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this._events.remove(id, request.account.id);
  }
}

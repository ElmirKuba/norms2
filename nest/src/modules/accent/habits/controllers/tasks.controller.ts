import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { createOneOffTaskSchema } from '../dtos/create-one-off-task.dto';
import type { CreateOneOffTaskDto } from '../dtos/create-one-off-task.dto';
import { completeTaskSchema } from '../dtos/complete-task.dto';
import type { CompleteTaskDto } from '../dtos/complete-task.dto';
import { ListTasksUseCase } from '../use-cases/list-tasks.use-case';
import { ListOverdueTasksUseCase } from '../use-cases/list-overdue-tasks.use-case';
import { ListDueTodayTasksUseCase } from '../use-cases/list-due-today-tasks.use-case';
import { CreateOneOffTaskUseCase } from '../use-cases/create-one-off-task.use-case';
import { CompleteTaskUseCase } from '../use-cases/complete-task.use-case';
import { UncompleteTaskUseCase } from '../use-cases/uncomplete-task.use-case';
import { PostponeTaskUseCase } from '../use-cases/postpone-task.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { CompleteTaskResult, TaskView } from '../interfaces/task-view.interface';

/**
 * Контроллер задач дня (`/api/v1/accent/tasks`) — под Guard (members-only, per-account).
 * Тонкий слой: controller → use-case. Все операции скоупятся по аккаунту из Guard. Задачи
 * дня материализуются из привычек при чтении (ленивая материализация, 2.4·8).
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class TasksController {
  /**
   * @param _list Список задач дня.
   * @param _overdue Просроченные разовые.
   * @param _dueToday Разовые с дедлайном сегодня.
   * @param _create Создание разовой.
   * @param _complete Выполнение.
   * @param _uncomplete Снятие отметки.
   * @param _postpone Перенос.
   */
  public constructor(
    private readonly _list: ListTasksUseCase,
    private readonly _overdue: ListOverdueTasksUseCase,
    private readonly _dueToday: ListDueTodayTasksUseCase,
    private readonly _create: CreateOneOffTaskUseCase,
    private readonly _complete: CompleteTaskUseCase,
    private readonly _uncomplete: UncompleteTaskUseCase,
    private readonly _postpone: PostponeTaskUseCase,
  ) {}

  /**
   * Задачи дня (по умолчанию — сегодня). Материализуются из привычек.
   * @param request Запрос (аккаунт из Guard).
   * @param date Дата `YYYY-MM-DD` (опц.).
   * @returns Проекции задач дня.
   */
  @Get('tasks')
  public list(
    @Req() request: AuthenticatedRequest,
    @Query('date') date?: string,
  ): Promise<TaskView[]> {
    return this._list.execute(request.account.id, request.account.timezone, date);
  }

  /**
   * Просроченные разовые задачи.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции просроченных задач.
   */
  @Get('tasks/overdue')
  public overdue(@Req() request: AuthenticatedRequest): Promise<TaskView[]> {
    return this._overdue.execute(request.account.id, request.account.timezone);
  }

  /**
   * Разовые задачи с дедлайном сегодня.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции задач с дедлайном сегодня.
   */
  @Get('tasks/due-today')
  public dueToday(@Req() request: AuthenticatedRequest): Promise<TaskView[]> {
    return this._dueToday.execute(request.account.id, request.account.timezone);
  }

  /**
   * Создаёт разовую задачу.
   * @param body Тело создания.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция созданной задачи (201).
   */
  @Post('tasks')
  public create(
    @Body(new ZodValidationPipe(createOneOffTaskSchema)) body: CreateOneOffTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskView> {
    return this._create.execute(request.account.id, body);
  }

  /**
   * Отмечает выполнение задачи.
   * @param id Идентификатор задачи.
   * @param body Тело (опц. `doneValue`).
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённая задача + событие лесенки (raised/lowered/null).
   */
  @Post('tasks/:id/complete')
  public complete(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(completeTaskSchema)) body: CompleteTaskDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CompleteTaskResult> {
    return this._complete.execute(
      id,
      request.account.id,
      request.account.timezone,
      body.doneValue,
    );
  }

  /**
   * Снимает отметку выполнения.
   * @param id Идентификатор задачи.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция обновлённой задачи.
   */
  @Post('tasks/:id/uncomplete')
  public uncomplete(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskView> {
    return this._uncomplete.execute(id, request.account.id);
  }

  /**
   * Переносит задачу на завтра.
   * @param id Идентификатор задачи.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция новой (завтрашней) задачи.
   */
  @Post('tasks/:id/postpone')
  public postpone(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<TaskView> {
    return this._postpone.execute(id, request.account.id);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { createHabitSchema } from '../dtos/create-habit.dto';
import type { CreateHabitDto } from '../dtos/create-habit.dto';
import { updateHabitSchema } from '../dtos/update-habit.dto';
import type { UpdateHabitDto } from '../dtos/update-habit.dto';
import { ListHabitsUseCase } from '../use-cases/list-habits.use-case';
import { GetHabitUseCase } from '../use-cases/get-habit.use-case';
import { CreateHabitUseCase } from '../use-cases/create-habit.use-case';
import { UpdateHabitUseCase } from '../use-cases/update-habit.use-case';
import { DeactivateHabitUseCase } from '../use-cases/deactivate-habit.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { HabitView } from '../interfaces/habit-view.interface';

/**
 * Контроллер привычек (`/api/v1/accent/habits`) — под Guard (members-only, per-account).
 * Тонкий слой: controller → use-case. Задачи дня (`/accent/tasks`) — отдельный контроллер
 * (2.4·13). Все операции скоупятся по аккаунту из Guard (владение).
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class HabitsController {
  /**
   * @param _list Список привычек.
   * @param _get Одна привычка.
   * @param _create Создание.
   * @param _update Обновление.
   * @param _deactivate Деактивация.
   */
  public constructor(
    private readonly _list: ListHabitsUseCase,
    private readonly _get: GetHabitUseCase,
    private readonly _create: CreateHabitUseCase,
    private readonly _update: UpdateHabitUseCase,
    private readonly _deactivate: DeactivateHabitUseCase,
  ) {}

  /**
   * Список активных привычек аккаунта.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции привычек.
   */
  @Get('habits')
  public list(@Req() request: AuthenticatedRequest): Promise<HabitView[]> {
    return this._list.execute(request.account.id);
  }

  /**
   * Создаёт привычку.
   * @param body Тело создания.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция созданной привычки (201).
   */
  @Post('habits')
  public create(
    @Body(new ZodValidationPipe(createHabitSchema)) body: CreateHabitDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<HabitView> {
    return this._create.execute(request.account.id, body);
  }

  /**
   * Одна привычка владельца.
   * @param id Идентификатор привычки.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция привычки.
   */
  @Get('habits/:id')
  public get(@Param('id') id: string, @Req() request: AuthenticatedRequest): Promise<HabitView> {
    return this._get.execute(id, request.account.id);
  }

  /**
   * Обновляет привычку владельца (частично).
   * @param id Идентификатор привычки.
   * @param body Поля для обновления.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция обновлённой привычки.
   */
  @Patch('habits/:id')
  public update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateHabitSchema)) body: UpdateHabitDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<HabitView> {
    return this._update.execute(id, request.account.id, body);
  }

  /**
   * Деактивирует привычку владельца (мягко).
   * @param id Идентификатор привычки.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция деактивированной привычки.
   */
  @Post('habits/:id/deactivate')
  public deactivate(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<HabitView> {
    return this._deactivate.execute(id, request.account.id);
  }
}

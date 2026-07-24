import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { createAntiHabitSchema } from '../dtos/create-anti-habit.dto';
import type { CreateAntiHabitDto } from '../dtos/create-anti-habit.dto';
import { updateAntiHabitSchema } from '../dtos/update-anti-habit.dto';
import type { UpdateAntiHabitDto } from '../dtos/update-anti-habit.dto';
import { relapseSchema } from '../dtos/relapse.dto';
import type { RelapseDto } from '../dtos/relapse.dto';
import { reorderAntiHabitsSchema } from '../dtos/reorder-anti-habits.dto';
import type { ReorderAntiHabitsDto } from '../dtos/reorder-anti-habits.dto';
import { ListAntiHabitsUseCase } from '../use-cases/list-anti-habits.use-case';
import { CreateAntiHabitUseCase } from '../use-cases/create-anti-habit.use-case';
import { GetAntiHabitUseCase } from '../use-cases/get-anti-habit.use-case';
import { UpdateAntiHabitUseCase } from '../use-cases/update-anti-habit.use-case';
import { RelapseAntiHabitUseCase } from '../use-cases/relapse-anti-habit.use-case';
import type { RelapseResultView } from '../use-cases/relapse-anti-habit.use-case';
import { ListAntiHabitRelapsesUseCase } from '../use-cases/list-anti-habit-relapses.use-case';
import { ReorderAntiHabitsUseCase } from '../use-cases/reorder-anti-habits.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { AntiHabitView } from '../interfaces/anti-habit-view.interface';
import type { AntiHabitRelapsePage } from '../interfaces/anti-habit-relapse-view.interface';

/**
 * Контроллер анти-привычек «держусь» (`/api/v1/accent/anti-habits`) — под Guard
 * (members-only, per-account). Тонкий слой: controller → use-case. Владение скоупится по
 * аккаунту из Guard (ownership проверяет domain-service). Серию «сколько держусь» считает
 * фронт из `currentAttemptStartedAt` (domain-model §7); история рецидивов — cursor-пагинация.
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class AntiHabitsController {
  /**
   * @param _list Список анти-привычек.
   * @param _create Создание.
   * @param _get Одна анти-привычка.
   * @param _update Обновление.
   * @param _relapse Рецидив.
   * @param _listRelapses История рецидивов.
   */
  public constructor(
    private readonly _list: ListAntiHabitsUseCase,
    private readonly _create: CreateAntiHabitUseCase,
    private readonly _get: GetAntiHabitUseCase,
    private readonly _update: UpdateAntiHabitUseCase,
    private readonly _relapse: RelapseAntiHabitUseCase,
    private readonly _listRelapses: ListAntiHabitRelapsesUseCase,
    private readonly _reorder: ReorderAntiHabitsUseCase,
  ) {}

  /**
   * Ручная сортировка перетаскиванием (ADR-0054): тело `{ ids }` — желаемый порядок. Объявлен
   * ДО `:id`. 204 без тела.
   * @param body Желаемый порядок id.
   * @param request Запрос (аккаунт из Guard).
   */
  @Put('anti-habits/reorder')
  @HttpCode(204)
  public async reorder(
    @Body(new ZodValidationPipe(reorderAntiHabitsSchema)) body: ReorderAntiHabitsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._reorder.execute(request.account.id, body.ids);
  }

  /**
   * Список анти-привычек аккаунта (активные).
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции анти-привычек.
   */
  @Get('anti-habits')
  public list(@Req() request: AuthenticatedRequest): Promise<AntiHabitView[]> {
    return this._list.execute(request.account.id);
  }

  /**
   * Создаёт анти-привычку (первая попытка стартует сейчас).
   * @param body Тело создания.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция созданной анти-привычки (201).
   */
  @Post('anti-habits')
  public create(
    @Body(new ZodValidationPipe(createAntiHabitSchema)) body: CreateAntiHabitDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AntiHabitView> {
    return this._create.execute(request.account.id, body);
  }

  /**
   * Одна анти-привычка владельца.
   * @param id Идентификатор.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция анти-привычки.
   */
  @Get('anti-habits/:id')
  public get(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<AntiHabitView> {
    return this._get.execute(id, request.account.id);
  }

  /**
   * Обновляет анти-привычку владельца (частично; `isActive:false` = убрать из списка).
   * @param id Идентификатор.
   * @param body Поля для обновления.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция обновлённой анти-привычки.
   */
  @Patch('anti-habits/:id')
  public update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateAntiHabitSchema)) body: UpdateAntiHabitDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AntiHabitView> {
    return this._update.execute(id, request.account.id, body);
  }

  /**
   * Фиксирует срыв: сброс таймера, обновление рекорда, запись попытки (409 `ALREADY_RELAPSED`
   * при повторном срыве в тот же момент / неактивной привычке).
   * @param id Идентификатор.
   * @param body Опц. триггер/заметка.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённая анти-привычка + записанный рецидив.
   */
  @Post('anti-habits/:id/relapse')
  public relapse(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(relapseSchema)) body: RelapseDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RelapseResultView> {
    return this._relapse.execute(id, request.account.id, body);
  }

  /**
   * История рецидивов (новые→старые, cursor-пагинация).
   * @param id Идентификатор.
   * @param request Запрос (аккаунт из Guard).
   * @param cursor Непрозрачный курсор или undefined.
   * @param limit Размер страницы (опц.).
   * @returns Страница рецидивов + `nextCursor`.
   */
  @Get('anti-habits/:id/relapses')
  public listRelapses(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<AntiHabitRelapsePage> {
    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    return this._listRelapses.execute(
      id,
      request.account.id,
      cursor,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }
}

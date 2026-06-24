import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { createHabitSchema } from '../dtos/create-habit.dto';
import type { CreateHabitDto } from '../dtos/create-habit.dto';
import { reorderHabitsSchema } from '../dtos/reorder-habits.dto';
import type { ReorderHabitsDto } from '../dtos/reorder-habits.dto';
import { ReorderHabitsUseCase } from '../use-cases/reorder-habits.use-case';
import { updateHabitSchema } from '../dtos/update-habit.dto';
import type { UpdateHabitDto } from '../dtos/update-habit.dto';
import { ListHabitsUseCase } from '../use-cases/list-habits.use-case';
import { GetHabitUseCase } from '../use-cases/get-habit.use-case';
import { CreateHabitUseCase } from '../use-cases/create-habit.use-case';
import { UpdateHabitUseCase } from '../use-cases/update-habit.use-case';
import { DeactivateHabitUseCase } from '../use-cases/deactivate-habit.use-case';
import { SeedHabitStarterPackUseCase } from '../use-cases/seed-habit-starter-pack.use-case';
import { ClearHabitStartersUseCase } from '../use-cases/clear-habit-starters.use-case';
import { AdoptHabitUseCase } from '../use-cases/adopt-habit.use-case';
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
    private readonly _seedStarterPack: SeedHabitStarterPackUseCase,
    private readonly _clearStarters: ClearHabitStartersUseCase,
    private readonly _adopt: AdoptHabitUseCase,
    private readonly _reorder: ReorderHabitsUseCase,
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
   * Ручная сортировка перетаскиванием (ADR-0054, → priority): тело `{ ids }`. Объявлен ДО `:id`. 204.
   * @param body Желаемый порядок id.
   * @param request Запрос (аккаунт из Guard).
   */
  @Put('habits/reorder')
  @HttpCode(204)
  public async reorder(
    @Body(new ZodValidationPipe(reorderHabitsSchema)) body: ReorderHabitsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._reorder.execute(request.account.id, body.ids);
  }

  /**
   * Получить стартовый пак привычек (докидывает примеры, своё не трогает; ADR-0051).
   * Объявлен ДО `:id`. Возвращает свежий список.
   * @param request Запрос (аккаунт из Guard).
   * @returns Список привычек после сева.
   */
  @Post('habits/starter-pack')
  public async getStarterPack(@Req() request: AuthenticatedRequest): Promise<HabitView[]> {
    await this._seedStarterPack.execute(request.account.id);
    return this._list.execute(request.account.id);
  }

  /**
   * Очистить примеры (удаляет только непринятые стартовые). Объявлен ДО `:id`.
   * @param request Запрос (аккаунт из Guard).
   * @returns Список привычек после очистки.
   */
  @Delete('habits/starter-pack')
  public async clearStarters(@Req() request: AuthenticatedRequest): Promise<HabitView[]> {
    await this._clearStarters.execute(request.account.id);
    return this._list.execute(request.account.id);
  }

  /**
   * Присвоить пример себе («Добавить себе»): снимает флаг — привычка начинает
   * материализовать задачи и двигать лесенку (ADR-0051).
   * @param id Идентификатор привычки.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция присвоенной привычки.
   */
  @Post('habits/:id/adopt')
  public adopt(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<HabitView> {
    return this._adopt.execute(id, request.account.id);
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

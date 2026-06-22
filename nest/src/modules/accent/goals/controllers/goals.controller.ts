import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { createGoalSchema } from '../dtos/create-goal.dto';
import type { CreateGoalDto } from '../dtos/create-goal.dto';
import { updateGoalSchema } from '../dtos/update-goal.dto';
import type { UpdateGoalDto } from '../dtos/update-goal.dto';
import { GOAL_STATUSES } from '../interfaces/goal-full.interface';
import type { GoalStatus } from '../interfaces/goal-full.interface';
import type { GoalListFilters } from '../adapters/accent-goal-repository.port';
import { ListGoalsUseCase } from '../use-cases/list-goals.use-case';
import { GetGoalUseCase } from '../use-cases/get-goal.use-case';
import { CreateGoalUseCase } from '../use-cases/create-goal.use-case';
import { UpdateGoalUseCase } from '../use-cases/update-goal.use-case';
import { ArchiveGoalUseCase } from '../use-cases/archive-goal.use-case';
import { RestoreGoalUseCase } from '../use-cases/restore-goal.use-case';
import { PauseGoalUseCase } from '../use-cases/pause-goal.use-case';
import { ResumeGoalUseCase } from '../use-cases/resume-goal.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { GoalView } from '../interfaces/goal-view.interface';

/**
 * Контроллер целей (`/api/v1/accent/goals`) — под Guard (members-only, per-account).
 * Тонкий слой: controller → use-case. Все операции скоупятся по аккаунту из Guard
 * (владение). Записи прогресса/вехи/подцели — отдельные эндпоинты (2.5·9/·11/·12).
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class GoalsController {
  /**
   * @param _list Список целей.
   * @param _get Одна цель.
   * @param _create Создание.
   * @param _update Обновление.
   * @param _archive Архивация.
   * @param _restore Восстановление.
   * @param _pause Пауза.
   * @param _resume Снятие паузы.
   */
  public constructor(
    private readonly _list: ListGoalsUseCase,
    private readonly _get: GetGoalUseCase,
    private readonly _create: CreateGoalUseCase,
    private readonly _update: UpdateGoalUseCase,
    private readonly _archive: ArchiveGoalUseCase,
    private readonly _restore: RestoreGoalUseCase,
    private readonly _pause: PauseGoalUseCase,
    private readonly _resume: ResumeGoalUseCase,
  ) {}

  /**
   * Список целей аккаунта (опц. фильтр `?status=&domain=`).
   * @param request Запрос (аккаунт из Guard).
   * @param status Фильтр по статусу (опц.; невалидный игнорируется).
   * @param domain Фильтр по сфере (опц.).
   * @returns Проекции целей.
   */
  @Get('goals')
  public list(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('domain') domain?: string,
  ): Promise<GoalView[]> {
    const filters: GoalListFilters = {};
    if (status !== undefined && (GOAL_STATUSES as readonly string[]).includes(status)) {
      filters.status = status as GoalStatus;
    }
    if (domain !== undefined && domain !== '') {
      filters.domainKey = domain;
    }
    return this._list.execute(request.account.id, filters);
  }

  /**
   * Создаёт цель.
   * @param body Тело создания.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция созданной цели (201).
   */
  @Post('goals')
  public create(
    @Body(new ZodValidationPipe(createGoalSchema)) body: CreateGoalDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._create.execute(request.account.id, body);
  }

  /**
   * Одна цель владельца.
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция цели.
   */
  @Get('goals/:id')
  public get(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._get.execute(id, request.account.id);
  }

  /**
   * Обновляет цель владельца (частично).
   * @param id Идентификатор цели.
   * @param body Поля для обновления.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция обновлённой цели.
   */
  @Patch('goals/:id')
  public update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGoalSchema)) body: UpdateGoalDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._update.execute(id, request.account.id, body);
  }

  /**
   * Архивирует цель (уходит из дашборда, не удаляется).
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция архивированной цели.
   */
  @Post('goals/:id/archive')
  public archive(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._archive.execute(id, request.account.id);
  }

  /**
   * Восстанавливает цель из архива в `active`.
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция восстановленной цели.
   */
  @Post('goals/:id/restore')
  public restore(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._restore.execute(id, request.account.id);
  }

  /**
   * Ставит цель на паузу (не принимает записи прогресса).
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция цели на паузе.
   */
  @Post('goals/:id/pause')
  public pause(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._pause.execute(id, request.account.id);
  }

  /**
   * Снимает цель с паузы.
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция активной цели.
   */
  @Post('goals/:id/resume')
  public resume(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._resume.execute(id, request.account.id);
  }
}

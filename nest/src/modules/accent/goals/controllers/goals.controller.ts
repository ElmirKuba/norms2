import {
  Body,
  Controller,
  Delete,
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
import { createGoalSchema } from '../dtos/create-goal.dto';
import type { CreateGoalDto } from '../dtos/create-goal.dto';
import { updateGoalSchema } from '../dtos/update-goal.dto';
import type { UpdateGoalDto } from '../dtos/update-goal.dto';
import { addGoalEntrySchema } from '../dtos/add-goal-entry.dto';
import type { AddGoalEntryDto } from '../dtos/add-goal-entry.dto';
import { GOAL_STATUSES } from '../interfaces/goal-full.interface';
import type { GoalStatus } from '../interfaces/goal-full.interface';
import type { GoalListFilters } from '../adapters/accent-goal-repository.port';
import { ListGoalsUseCase } from '../use-cases/list-goals.use-case';
import { GetGoalUseCase } from '../use-cases/get-goal.use-case';
import { CreateGoalUseCase } from '../use-cases/create-goal.use-case';
import { UpdateGoalUseCase } from '../use-cases/update-goal.use-case';
import { ArchiveGoalUseCase } from '../use-cases/archive-goal.use-case';
import { RestoreGoalUseCase } from '../use-cases/restore-goal.use-case';
import { ReopenGoalUseCase } from '../use-cases/reopen-goal.use-case';
import { PauseGoalUseCase } from '../use-cases/pause-goal.use-case';
import { ResumeGoalUseCase } from '../use-cases/resume-goal.use-case';
import { AddGoalEntryUseCase } from '../use-cases/add-goal-entry.use-case';
import type { AddGoalEntryResult } from '../use-cases/add-goal-entry.use-case';
import { ListGoalEntriesUseCase } from '../use-cases/list-goal-entries.use-case';
import { AddMilestoneUseCase } from '../use-cases/add-milestone.use-case';
import { ListMilestonesUseCase } from '../use-cases/list-milestones.use-case';
import { RemoveMilestoneUseCase } from '../use-cases/remove-milestone.use-case';
import { ListChildGoalsUseCase } from '../use-cases/list-child-goals.use-case';
import { SeedGoalStarterPackUseCase } from '../use-cases/seed-goal-starter-pack.use-case';
import { ClearGoalStartersUseCase } from '../use-cases/clear-goal-starters.use-case';
import { AdoptGoalUseCase } from '../use-cases/adopt-goal.use-case';
import { ToggleGoalFocusUseCase } from '../use-cases/toggle-goal-focus.use-case';
import { ReorderGoalsUseCase } from '../use-cases/reorder-goals.use-case';
import { ReorderGoalFocusUseCase } from '../use-cases/reorder-goal-focus.use-case';
import { reorderGoalsSchema } from '../dtos/reorder-goals.dto';
import type { ReorderGoalsDto } from '../dtos/reorder-goals.dto';
import { RemoveGoalEntryUseCase } from '../use-cases/remove-goal-entry.use-case';
import { UpdateGoalEntryUseCase } from '../use-cases/update-goal-entry.use-case';
import { updateGoalEntrySchema } from '../dtos/update-goal-entry.dto';
import type { UpdateGoalEntryDto } from '../dtos/update-goal-entry.dto';
import { addMilestoneSchema } from '../dtos/add-milestone.dto';
import type { AddMilestoneDto } from '../dtos/add-milestone.dto';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { GoalView } from '../interfaces/goal-view.interface';
import type { GoalProgressView } from '../interfaces/goal-progress-view.interface';
import type { GoalEntryView } from '../interfaces/goal-entry-view.interface';
import type { MilestoneView } from '../interfaces/milestone-view.interface';
import type { GoalFocusResult } from '../interfaces/goal-focus-result.interface';

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
    private readonly _reopen: ReopenGoalUseCase,
    private readonly _pause: PauseGoalUseCase,
    private readonly _resume: ResumeGoalUseCase,
    private readonly _addEntry: AddGoalEntryUseCase,
    private readonly _listEntries: ListGoalEntriesUseCase,
    private readonly _addMilestone: AddMilestoneUseCase,
    private readonly _listMilestones: ListMilestonesUseCase,
    private readonly _removeMilestone: RemoveMilestoneUseCase,
    private readonly _listChildren: ListChildGoalsUseCase,
    private readonly _removeEntry: RemoveGoalEntryUseCase,
    private readonly _updateEntry: UpdateGoalEntryUseCase,
    private readonly _seedPack: SeedGoalStarterPackUseCase,
    private readonly _clearStarters: ClearGoalStartersUseCase,
    private readonly _adopt: AdoptGoalUseCase,
    private readonly _toggleFocus: ToggleGoalFocusUseCase,
    private readonly _reorder: ReorderGoalsUseCase,
    private readonly _reorderFocus: ReorderGoalFocusUseCase,
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
  ): Promise<GoalProgressView[]> {
    const filters: GoalListFilters = {};
    if (status !== undefined && (GOAL_STATUSES as readonly string[]).includes(status)) {
      filters.status = status as GoalStatus;
    }
    if (domain !== undefined && domain !== '') {
      filters.domainKey = domain;
    }
    return this._list.execute(request.account.id, request.account.timezone, filters);
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
   * Ручная сортировка целей перетаскиванием (ADR-0054): тело `{ ids }` — желаемый порядок.
   * Объявлен ДО `:id`. 204 без тела.
   * @param body Желаемый порядок id.
   * @param request Запрос (аккаунт из Guard).
   */
  @Put('goals/reorder')
  @HttpCode(204)
  public async reorder(
    @Body(new ZodValidationPipe(reorderGoalsSchema)) body: ReorderGoalsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._reorder.execute(request.account.id, body.ids);
  }

  /**
   * Перестановка ранга фокуса перетаскиванием (ADR-0053/0054): тело `{ ids }` фокусных целей.
   * Объявлен ДО `:id`. 204.
   * @param body Желаемый порядок фокусных id.
   * @param request Запрос (аккаунт из Guard).
   */
  @Put('goals/focus-reorder')
  @HttpCode(204)
  public async reorderFocus(
    @Body(new ZodValidationPipe(reorderGoalsSchema)) body: ReorderGoalsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._reorderFocus.execute(request.account.id, body.ids);
  }

  /**
   * Получить стартовый пак целей (докидывает примеры, ADR-0051). Объявлен ДО `:id`.
   * Возвращает свежий список активных целей (вкл. примеры).
   * @param request Запрос (аккаунт из Guard).
   * @returns Список целей после сева.
   */
  @Post('goals/starter-pack')
  public async getStarterPack(
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalProgressView[]> {
    await this._seedPack.execute(request.account.id);
    return this._list.execute(request.account.id, request.account.timezone, { status: 'active' });
  }

  /**
   * Очистить примеры (удаляет только непринятые стартовые). Объявлен ДО `:id`.
   * @param request Запрос (аккаунт из Guard).
   * @returns Список целей после очистки.
   */
  @Delete('goals/starter-pack')
  public async clearStarters(
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalProgressView[]> {
    await this._clearStarters.execute(request.account.id);
    return this._list.execute(request.account.id, request.account.timezone, { status: 'active' });
  }

  /**
   * Присвоить пример себе («Добавить себе», ADR-0051): снимает флаг — цель становится в работе.
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция присвоенной цели.
   */
  @Post('goals/:id/adopt')
  public adopt(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._adopt.execute(id, request.account.id);
  }

  /**
   * Поставить цель «в фокус» (ADR-0053). Мягкий порог — в ответе `overLimit` (не блок).
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Цель + мета фокуса.
   */
  @Post('goals/:id/focus')
  public focus(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalFocusResult> {
    return this._toggleFocus.execute(id, request.account.id, true);
  }

  /**
   * Убрать цель «из фокуса» (ADR-0053).
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Цель + мета фокуса.
   */
  @Delete('goals/:id/focus')
  public unfocus(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalFocusResult> {
    return this._toggleFocus.execute(id, request.account.id, false);
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
  ): Promise<GoalProgressView> {
    return this._get.execute(id, request.account.id, request.account.timezone);
  }

  /**
   * Прямые подцели цели (с вычисляемым прогрессом).
   * @param id Идентификатор родительской цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции подцелей.
   */
  @Get('goals/:id/children')
  public children(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalProgressView[]> {
    return this._listChildren.execute(id, request.account.id, request.account.timezone);
  }

  /**
   * Добавляет запись прогресса к цели (триггерит пересчёт + возможное авто-завершение).
   * @param id Идентификатор цели.
   * @param body Тело (значение/дата/заметка).
   * @param request Запрос (аккаунт из Guard).
   * @returns Созданная запись + цель с прогрессом (201).
   */
  @Post('goals/:id/entries')
  public addEntry(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addGoalEntrySchema)) body: AddGoalEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<AddGoalEntryResult> {
    return this._addEntry.execute(id, request.account.id, body, request.account.timezone);
  }

  /**
   * История записей прогресса цели (новые сверху, курсор по `id`).
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @param cursor Курсор (id последней полученной) или undefined.
   * @param limit Размер страницы (опц.).
   * @returns Страница записей.
   */
  @Get('goals/:id/entries')
  public listEntries(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<GoalEntryView[]> {
    const parsedLimit = limit !== undefined ? Number(limit) : undefined;
    return this._listEntries.execute(
      id,
      request.account.id,
      cursor,
      Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    );
  }

  /**
   * Правит запись прогресса (ручная коррекция, патч 8).
   * @param id Идентификатор цели.
   * @param entryId Идентификатор записи.
   * @param body Поля для правки.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённая запись.
   */
  @Patch('goals/:id/entries/:entryId')
  public updateEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body(new ZodValidationPipe(updateGoalEntrySchema)) body: UpdateGoalEntryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalEntryView> {
    return this._updateEntry.execute(id, entryId, request.account.id, body);
  }

  /**
   * Удаляет запись прогресса (ручная коррекция, патч 8).
   * @param id Идентификатор цели.
   * @param entryId Идентификатор записи.
   * @param request Запрос (аккаунт из Guard).
   */
  @Delete('goals/:id/entries/:entryId')
  @HttpCode(204)
  public removeEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this._removeEntry.execute(id, entryId, request.account.id);
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
   * Возвращает завершённую цель в работу (из `completed` в `active`).
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция вернувшейся в работу цели.
   */
  @Post('goals/:id/reopen')
  public reopen(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalView> {
    return this._reopen.execute(id, request.account.id);
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

  /**
   * Добавляет веху к цели.
   * @param id Идентификатор цели.
   * @param body Название + порог.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция созданной вехи (201).
   */
  @Post('goals/:id/milestones')
  public addMilestone(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addMilestoneSchema)) body: AddMilestoneDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<MilestoneView> {
    return this._addMilestone.execute(id, request.account.id, body);
  }

  /**
   * Вехи цели (по возрастанию порога, с вычисленным `reached`).
   * @param id Идентификатор цели.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции вех.
   */
  @Get('goals/:id/milestones')
  public listMilestones(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<MilestoneView[]> {
    return this._listMilestones.execute(id, request.account.id);
  }

  /**
   * Удаляет веху (только не достигнутую).
   * @param id Идентификатор цели.
   * @param mid Идентификатор вехи.
   * @param request Запрос (аккаунт из Guard).
   */
  @Delete('goals/:id/milestones/:mid')
  @HttpCode(204)
  public removeMilestone(
    @Param('id') id: string,
    @Param('mid') mid: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this._removeMilestone.execute(id, mid, request.account.id);
  }
}

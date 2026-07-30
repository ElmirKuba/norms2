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
import { createObstacleSchema } from '../dtos/create-obstacle.dto';
import type { CreateObstacleDto } from '../dtos/create-obstacle.dto';
import { updateObstacleSchema } from '../dtos/update-obstacle.dto';
import type { UpdateObstacleDto } from '../dtos/update-obstacle.dto';
import { reorderObstaclesSchema } from '../dtos/reorder-obstacles.dto';
import type { ReorderObstaclesDto } from '../dtos/reorder-obstacles.dto';
import { createCounterplaySchema } from '../dtos/create-counterplay.dto';
import type { CreateCounterplayDto } from '../dtos/create-counterplay.dto';
import { updateCounterplaySchema } from '../dtos/update-counterplay.dto';
import type { UpdateCounterplayDto } from '../dtos/update-counterplay.dto';
import { reorderCounterplaysSchema } from '../dtos/reorder-counterplays.dto';
import type { ReorderCounterplaysDto } from '../dtos/reorder-counterplays.dto';
import { createEncounterSchema } from '../dtos/create-encounter.dto';
import type { CreateEncounterDto } from '../dtos/create-encounter.dto';
import { setEncounterOutcomeSchema } from '../dtos/set-encounter-outcome.dto';
import type { SetEncounterOutcomeDto } from '../dtos/set-encounter-outcome.dto';
import { ListObstaclesUseCase } from '../use-cases/list-obstacles.use-case';
import { GetObstacleUseCase } from '../use-cases/get-obstacle.use-case';
import { CreateObstacleUseCase } from '../use-cases/create-obstacle.use-case';
import { UpdateObstacleUseCase } from '../use-cases/update-obstacle.use-case';
import { DeleteObstacleUseCase } from '../use-cases/delete-obstacle.use-case';
import { ReorderObstaclesUseCase } from '../use-cases/reorder-obstacles.use-case';
import { ListCounterplaysUseCase } from '../use-cases/list-counterplays.use-case';
import { CreateCounterplayUseCase } from '../use-cases/create-counterplay.use-case';
import { UpdateCounterplayUseCase } from '../use-cases/update-counterplay.use-case';
import { DeleteCounterplayUseCase } from '../use-cases/delete-counterplay.use-case';
import { ReorderCounterplaysUseCase } from '../use-cases/reorder-counterplays.use-case';
import { RecordEncounterUseCase } from '../use-cases/record-encounter.use-case';
import type { EncounterRecordResult } from '../use-cases/record-encounter.use-case';
import { ListEncountersUseCase } from '../use-cases/list-encounters.use-case';
import { SetEncounterOutcomeUseCase } from '../use-cases/set-encounter-outcome.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { ObstacleListView, ObstacleView } from '../interfaces/obstacle-view.interface';
import type { CounterplayView } from '../interfaces/counterplay-view.interface';
import type {
  ObstacleEncounterPage,
  ObstacleEncounterView,
} from '../interfaces/obstacle-encounter-view.interface';

/**
 * Контроллер препятствий (`/api/v1/accent/obstacles`) — под Guard (members-only, per-account).
 * Тонкий слой: controller → use-case. Владение скоупится по аккаунту из Guard (ownership
 * проверяет domain-service). Контрмеры (блок C) и журнал столкновений (блок D) добавятся
 * своими маршрутами сюда же.
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class ObstaclesController {
  /**
   * @param _list Список препятствий.
   * @param _get Одно препятствие.
   * @param _create Создание.
   * @param _update Обновление.
   * @param _delete Удаление.
   * @param _reorder Ручная сортировка.
   * @param _listCounterplays Список контрмер.
   * @param _createCounterplay Добавление контрмеры.
   * @param _updateCounterplay Правка контрмеры.
   * @param _deleteCounterplay Удаление контрмеры.
   * @param _reorderCounterplays Сортировка контрмер.
   * @param _recordEncounter Запись столкновения («Столкнулся»).
   * @param _listEncounters Лента столкновений.
   * @param _setOutcome Проставление исхода задним числом.
   */
  public constructor(
    private readonly _list: ListObstaclesUseCase,
    private readonly _get: GetObstacleUseCase,
    private readonly _create: CreateObstacleUseCase,
    private readonly _update: UpdateObstacleUseCase,
    private readonly _delete: DeleteObstacleUseCase,
    private readonly _reorder: ReorderObstaclesUseCase,
    private readonly _listCounterplays: ListCounterplaysUseCase,
    private readonly _createCounterplay: CreateCounterplayUseCase,
    private readonly _updateCounterplay: UpdateCounterplayUseCase,
    private readonly _deleteCounterplay: DeleteCounterplayUseCase,
    private readonly _reorderCounterplays: ReorderCounterplaysUseCase,
    private readonly _recordEncounter: RecordEncounterUseCase,
    private readonly _listEncounters: ListEncountersUseCase,
    private readonly _setOutcome: SetEncounterOutcomeUseCase,
  ) {}

  /**
   * Ручная сортировка перетаскиванием (ADR-0054): тело `{ ids }` — желаемый порядок. Объявлен
   * **ДО** `:id`, иначе `reorder` уедет в параметр маршрута. 204 без тела.
   * @param body Желаемый порядок id.
   * @param request Запрос (аккаунт из Guard).
   */
  @Put('obstacles/reorder')
  @HttpCode(204)
  public async reorder(
    @Body(new ZodValidationPipe(reorderObstaclesSchema)) body: ReorderObstaclesDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._reorder.execute(request.account.id, body);
  }

  /**
   * Список препятствий аккаунта (активные, в ручном порядке) + флаг мягкого порога.
   * @param request Запрос (аккаунт из Guard).
   * @returns `{ items, softLimitExceeded }`.
   */
  @Get('obstacles')
  public list(@Req() request: AuthenticatedRequest): Promise<ObstacleListView> {
    return this._list.execute(request.account.id);
  }

  /**
   * Создаёт препятствие. Мягкий порог не блокирует — только помечает список (ADR-0062 п.8).
   * @param body Тело создания.
   * @param request Запрос (аккаунт из Guard).
   * @returns Созданное препятствие.
   */
  @Post('obstacles')
  public create(
    @Body(new ZodValidationPipe(createObstacleSchema)) body: CreateObstacleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ObstacleView> {
    return this._create.execute(request.account.id, body);
  }

  /**
   * Одно препятствие владельца.
   * @param id Идентификатор препятствия.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция препятствия.
   */
  @Get('obstacles/:id')
  public get(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ObstacleView> {
    return this._get.execute(id, request.account.id);
  }

  /**
   * Правит препятствие (частично). `isActive:false` = убрать из списка; правка примера
   * присваивает его (ADR-0051).
   * @param id Идентификатор препятствия.
   * @param body Поля для обновления.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённое препятствие.
   */
  @Patch('obstacles/:id')
  public update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateObstacleSchema)) body: UpdateObstacleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ObstacleView> {
    return this._update.execute(id, request.account.id, body);
  }

  /**
   * Полностью удаляет препятствие (контрмеры и журнал — каскадом; ссылки из истории «Держусь»
   * обнуляются). 204 без тела.
   * @param id Идентификатор препятствия.
   * @param request Запрос (аккаунт из Guard).
   */
  @Delete('obstacles/:id')
  @HttpCode(204)
  public async remove(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._delete.execute(id, request.account.id);
  }

  // ─── Контрмеры (свои готовые ответы на препятствие) ───────────────────────────────────

  /**
   * Сортировка контрмер перетаскиванием (ADR-0054). Объявлен **ДО** `:cid`. 204 без тела.
   * @param obstacleId Идентификатор препятствия.
   * @param body Желаемый порядок id.
   * @param request Запрос (аккаунт из Guard).
   */
  @Put('obstacles/:id/counterplays/reorder')
  @HttpCode(204)
  public async reorderCounterplays(
    @Param('id') obstacleId: string,
    @Body(new ZodValidationPipe(reorderCounterplaysSchema)) body: ReorderCounterplaysDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._reorderCounterplays.execute(obstacleId, request.account.id, body);
  }

  /**
   * Контрмеры препятствия в ручном порядке.
   * @param obstacleId Идентификатор препятствия.
   * @param request Запрос (аккаунт из Guard).
   * @returns Список контрмер.
   */
  @Get('obstacles/:id/counterplays')
  public listCounterplays(
    @Param('id') obstacleId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CounterplayView[]> {
    return this._listCounterplays.execute(obstacleId, request.account.id);
  }

  /**
   * Добавляет контрмеру. На примере-витрине запрещено до «Добавить себе» (ADR-0051) → 400.
   * @param obstacleId Идентификатор препятствия.
   * @param body Тело создания.
   * @param request Запрос (аккаунт из Guard).
   * @returns Созданная контрмера.
   */
  @Post('obstacles/:id/counterplays')
  public createCounterplay(
    @Param('id') obstacleId: string,
    @Body(new ZodValidationPipe(createCounterplaySchema)) body: CreateCounterplayDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CounterplayView> {
    return this._createCounterplay.execute(obstacleId, request.account.id, body);
  }

  /**
   * Правит контрмеру (`linkedMicroWinId: null` — снять привязку).
   * @param obstacleId Идентификатор препятствия.
   * @param counterplayId Идентификатор контрмеры.
   * @param body Поля для обновления.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённая контрмера.
   */
  @Patch('obstacles/:id/counterplays/:cid')
  public updateCounterplay(
    @Param('id') obstacleId: string,
    @Param('cid') counterplayId: string,
    @Body(new ZodValidationPipe(updateCounterplaySchema)) body: UpdateCounterplayDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CounterplayView> {
    return this._updateCounterplay.execute(counterplayId, obstacleId, request.account.id, body);
  }

  /**
   * Удаляет контрмеру. 204 без тела.
   * @param obstacleId Идентификатор препятствия.
   * @param counterplayId Идентификатор контрмеры.
   * @param request Запрос (аккаунт из Guard).
   */
  @Delete('obstacles/:id/counterplays/:cid')
  @HttpCode(204)
  public async deleteCounterplay(
    @Param('id') obstacleId: string,
    @Param('cid') counterplayId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._deleteCounterplay.execute(counterplayId, obstacleId, request.account.id);
  }

  // ─── Журнал столкновений («Столкнулся») ───────────────────────────────────────────────

  /**
   * Записывает столкновение — главный поток раздела. Ничего обязательного: без `counterplayId`
   * это «просто отметить», `outcome` можно проставить позже. Возвращает и запись, и свежую
   * карточку — счётчики вычисляются на чтение, иначе фронту пришлось бы делать второй запрос.
   * @param obstacleId Идентификатор препятствия.
   * @param body Тело записи.
   * @param request Запрос (аккаунт из Guard).
   * @returns Запись + обновлённое препятствие.
   */
  @Post('obstacles/:id/encounters')
  public recordEncounter(
    @Param('id') obstacleId: string,
    @Body(new ZodValidationPipe(createEncounterSchema)) body: CreateEncounterDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<EncounterRecordResult> {
    return this._recordEncounter.execute(obstacleId, request.account.id, body);
  }

  /**
   * Лента столкновений (новые→старые, keyset-пагинация).
   * @param obstacleId Идентификатор препятствия.
   * @param limit Размер страницы (1..100, дефолт 30).
   * @param cursor Непрозрачный курсор следующей страницы.
   * @param request Запрос (аккаунт из Guard).
   * @returns Страница ленты.
   */
  @Get('obstacles/:id/encounters')
  public listEncounters(
    @Param('id') obstacleId: string,
    @Query('limit') limit: string | undefined,
    @Query('cursor') cursor: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<ObstacleEncounterPage> {
    return this._listEncounters.execute(obstacleId, request.account.id, limit, cursor);
  }

  /**
   * Проставляет исход задним числом («Помогло?» в ленте) — единственный modify в append-only
   * журнале. Отвечать необязательно, пустой исход нигде не считается негативом.
   * @param obstacleId Идентификатор препятствия.
   * @param encounterId Идентификатор записи.
   * @param body Исход.
   * @param request Запрос (аккаунт из Guard).
   * @returns Обновлённая запись.
   */
  @Patch('obstacles/:id/encounters/:eid')
  public setEncounterOutcome(
    @Param('id') obstacleId: string,
    @Param('eid') encounterId: string,
    @Body(new ZodValidationPipe(setEncounterOutcomeSchema)) body: SetEncounterOutcomeDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ObstacleEncounterView> {
    return this._setOutcome.execute(encounterId, obstacleId, request.account.id, body);
  }
}

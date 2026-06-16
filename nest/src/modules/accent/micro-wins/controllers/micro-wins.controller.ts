import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../../auth/guards/auth.guard';
import { createMicroWinSchema } from '../dtos/create-micro-win.dto';
import type { CreateMicroWinDto } from '../dtos/create-micro-win.dto';
import { updateMicroWinSchema } from '../dtos/update-micro-win.dto';
import type { UpdateMicroWinDto } from '../dtos/update-micro-win.dto';
import { ListMicroWinsUseCase } from '../use-cases/list-micro-wins.use-case';
import { CreateMicroWinUseCase } from '../use-cases/create-micro-win.use-case';
import { UpdateMicroWinUseCase } from '../use-cases/update-micro-win.use-case';
import { DeleteMicroWinUseCase } from '../use-cases/delete-micro-win.use-case';
import type { AuthenticatedRequest } from '../../../auth/interfaces/authenticated-request.interface';
import type { MicroWinView } from '../interfaces/micro-win-view.interface';

/**
 * Контроллер микро-побед (`/api/v1/accent/micro-wins`) — под Guard (members-only,
 * per-account). Тонкий слой: controller → use-case. `complete` (лог выполнения) —
 * подфаза 2.2·4. Все операции скоупятся по аккаунту из Guard (владение).
 */
@Controller('accent')
@UseGuards(AuthGuard)
export class MicroWinsController {
  /**
   * @param _list Список микро-побед.
   * @param _create Создание.
   * @param _update Обновление.
   * @param _delete Удаление.
   */
  public constructor(
    private readonly _list: ListMicroWinsUseCase,
    private readonly _create: CreateMicroWinUseCase,
    private readonly _update: UpdateMicroWinUseCase,
    private readonly _delete: DeleteMicroWinUseCase,
  ) {}

  /**
   * Список активных микро-побед аккаунта.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции микро-побед.
   */
  @Get('micro-wins')
  public list(@Req() request: AuthenticatedRequest): Promise<MicroWinView[]> {
    return this._list.execute(request.account.id);
  }

  /**
   * Создаёт микро-победу.
   * @param body Тело создания.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция созданной микро-победы (201).
   */
  @Post('micro-wins')
  public create(
    @Body(new ZodValidationPipe(createMicroWinSchema)) body: CreateMicroWinDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<MicroWinView> {
    return this._create.execute(request.account.id, body);
  }

  /**
   * Обновляет микро-победу владельца (частично).
   * @param id Идентификатор микро-победы.
   * @param body Поля для обновления.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция обновлённой микро-победы.
   */
  @Patch('micro-wins/:id')
  public update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMicroWinSchema)) body: UpdateMicroWinDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<MicroWinView> {
    return this._update.execute(id, request.account.id, body);
  }

  /**
   * Удаляет микро-победу владельца.
   * @param id Идентификатор микро-победы.
   * @param request Запрос (аккаунт из Guard).
   * @returns 204.
   */
  @Delete('micro-wins/:id')
  @HttpCode(204)
  public async remove(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._delete.execute(id, request.account.id);
  }
}

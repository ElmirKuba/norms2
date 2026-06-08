import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createBanSchema } from '../dtos/create-ban.dto';
import type { CreateBanDto } from '../dtos/create-ban.dto';
import { BanUserUseCase } from '../use-cases/ban-user.use-case';
import { UnbanUserUseCase } from '../use-cases/unban-user.use-case';
import { ListMyBansUseCase } from '../use-cases/list-my-bans.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { BanView } from '../interfaces/ban-view.interface';
import type { BanListItem } from '../interfaces/ban-list-item.interface';

/**
 * Контроллер банов (`/api/v1/bans/*`) — всё под Guard (нужен аккаунт-банящий).
 * Бан — только в своём поддереве; снятие — только своей записи (ADR-0003).
 */
@Controller('bans')
export class BansController {
  /**
   * @param _banUserUseCase Поставить бан.
   * @param _unbanUserUseCase Снять свой бан.
   * @param _listMyBansUseCase Мои баны.
   */
  public constructor(
    private readonly _banUserUseCase: BanUserUseCase,
    private readonly _unbanUserUseCase: UnbanUserUseCase,
    private readonly _listMyBansUseCase: ListMyBansUseCase,
  ) {}

  /**
   * Банит цель в своём поддереве.
   * @param body Тело (targetId, reason).
   * @param request Запрос (аккаунт из Guard).
   * @returns Запись бана.
   */
  @Post()
  @UseGuards(AuthGuard)
  public async ban(
    @Body(new ZodValidationPipe(createBanSchema)) body: CreateBanDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BanView> {
    const ban = await this._banUserUseCase.execute(request.account.id, body.targetId, body.reason);
    return { id: ban.id, targetId: ban.targetId, reason: ban.reason, active: ban.active, createdAt: ban.createdAt };
  }

  /**
   * Снимает свой бан.
   * @param id Идентификатор записи.
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения.
   */
  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  public async unban(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._unbanUserUseCase.execute(id, request.account.id);
  }

  /**
   * Список «мои баны».
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции банов.
   */
  @Get()
  @UseGuards(AuthGuard)
  public async listMine(@Req() request: AuthenticatedRequest): Promise<BanListItem[]> {
    return this._listMyBansUseCase.execute(request.account.id);
  }
}

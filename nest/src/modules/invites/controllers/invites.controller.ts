import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../../shared/pipes/zod-validation.pipe';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { createInviteSchema } from '../dtos/create-invite.dto';
import type { CreateInviteDto } from '../dtos/create-invite.dto';
import { checkInviteSchema } from '../dtos/check-invite.dto';
import type { CheckInviteDto } from '../dtos/check-invite.dto';
import { CreateInviteUseCase } from '../use-cases/create-invite.use-case';
import { RevokeInviteUseCase } from '../use-cases/revoke-invite.use-case';
import { CheckInviteCodeUseCase } from '../use-cases/check-invite-code.use-case';
import { ListMyInvitesUseCase } from '../use-cases/list-my-invites.use-case';
import { GetMyInviterUseCase } from '../use-cases/get-my-inviter.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { CreateInviteResponse } from '../interfaces/create-invite-response.interface';
import type { CheckInviteResponse } from '../interfaces/check-invite-response.interface';
import type { InviteeRead } from '../interfaces/invitee-read.interface';
import type { InviterRead } from '../interfaces/inviter-read.interface';

/**
 * Контроллер инвайтов (`/api/v1/invites/*`). Создание/отзыв/список — под Guard
 * (нужен аккаунт); `/check` — публичный (предпроверка кода на фронте).
 */
@Controller('invites')
export class InvitesController {
  /**
   * @param _createInviteUseCase Создание.
   * @param _revokeInviteUseCase Отзыв.
   * @param _checkInviteCodeUseCase Проверка.
   * @param _listMyInvitesUseCase Список приглашённых.
   * @param _getMyInviterUseCase Кто меня пригласил.
   */
  public constructor(
    private readonly _createInviteUseCase: CreateInviteUseCase,
    private readonly _revokeInviteUseCase: RevokeInviteUseCase,
    private readonly _checkInviteCodeUseCase: CheckInviteCodeUseCase,
    private readonly _listMyInvitesUseCase: ListMyInvitesUseCase,
    private readonly _getMyInviterUseCase: GetMyInviterUseCase,
  ) {}

  /**
   * Создаёт код приглашения (списывает квоту).
   * @param body Тело (причина).
   * @param request Запрос (аккаунт из Guard).
   * @returns Созданный код.
   */
  @Post()
  @UseGuards(AuthGuard)
  public async create(
    @Body(new ZodValidationPipe(createInviteSchema)) body: CreateInviteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreateInviteResponse> {
    const code = await this._createInviteUseCase.execute(request.account.id, body.reason);
    return { id: code.id, code: code.code, reason: code.reason, expiresAt: code.expiresAt };
  }

  /**
   * Отзывает свой код (возвращает квоту).
   * @param id Идентификатор кода.
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения.
   */
  @Delete(':id')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  public async revoke(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._revokeInviteUseCase.execute(id, request.account.id);
  }

  /**
   * Предпроверка кода (публично).
   * @param body Тело (код).
   * @returns { valid }.
   */
  @Post('check')
  @HttpCode(200)
  public async check(
    @Body(new ZodValidationPipe(checkInviteSchema)) body: CheckInviteDto,
  ): Promise<CheckInviteResponse> {
    return this._checkInviteCodeUseCase.execute(body.code);
  }

  /**
   * Список «мои приглашённые».
   * @param request Запрос (аккаунт из Guard).
   * @returns Список приглашённых.
   */
  @Get()
  @UseGuards(AuthGuard)
  public async listMine(@Req() request: AuthenticatedRequest): Promise<InviteeRead[]> {
    return this._listMyInvitesUseCase.execute(request.account.id);
  }

  /**
   * «Кто меня пригласил» (обратное ребро). null у корней дерева (free/seed).
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекция пригласившего или null.
   */
  @Get('my-inviter')
  @UseGuards(AuthGuard)
  public async myInviter(@Req() request: AuthenticatedRequest): Promise<InviterRead | null> {
    return this._getMyInviterUseCase.execute(request.account.id);
  }
}

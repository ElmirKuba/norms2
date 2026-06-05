import { Controller, Delete, Get, HttpCode, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ListMySessionsUseCase } from '../use-cases/list-my-sessions.use-case';
import { RevokeSessionUseCase } from '../use-cases/revoke-session.use-case';
import { RevokeOtherSessionsUseCase } from '../use-cases/revoke-other-sessions.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { SessionView } from '../interfaces/session-view.interface';

/**
 * Контроллер управления сессиями/устройствами (`/api/v1/sessions/*`) — под Guard.
 * «Текущее» устройство определяется по `sid` access-токена (ADR-0041); refresh-
 * cookie сюда не приходит (скоуп `/auth`).
 */
@Controller('sessions')
export class SessionsController {
  /**
   * @param _listMySessionsUseCase Список устройств.
   * @param _revokeSessionUseCase Отзыв своей сессии.
   */
  public constructor(
    private readonly _listMySessionsUseCase: ListMySessionsUseCase,
    private readonly _revokeSessionUseCase: RevokeSessionUseCase,
    private readonly _revokeOtherSessionsUseCase: RevokeOtherSessionsUseCase,
  ) {}

  /**
   * Список активных сессий (устройств) с пометкой текущего.
   * @param request Запрос (аккаунт+sid из Guard).
   * @returns Проекции сессий.
   */
  @Get()
  @UseGuards(AuthGuard)
  public async listMine(@Req() request: AuthenticatedRequest): Promise<SessionView[]> {
    return this._listMySessionsUseCase.execute(request.account.id, request.sessionId);
  }

  /**
   * Выход на всех остальных устройствах (кроме текущего). Объявлен ДО `:id`
   * (иначе `others` поймался бы как параметр).
   * @param request Запрос (аккаунт+sid из Guard).
   * @returns Промис завершения.
   */
  @Delete('others')
  @UseGuards(AuthGuard)
  @HttpCode(204)
  public async revokeOthers(@Req() request: AuthenticatedRequest): Promise<void> {
    await this._revokeOtherSessionsUseCase.execute(request.account.id, request.sessionId);
  }

  /**
   * Отзывает свою сессию (выход с устройства).
   * @param id Идентификатор сессии.
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
    await this._revokeSessionUseCase.execute(id, request.account.id);
  }
}

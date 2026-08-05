import { Controller, Delete, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RateLimit } from '../../../shared/guards/rate-limit.decorator';
import { ManageTelegramLinkUseCase } from '../use-cases/manage-telegram-link.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { TelegramLinkStatus } from '../interfaces/telegram-link-status.interface';
import type { TelegramLinkCodeView } from '../interfaces/telegram-link-code-view.interface';

/**
 * Привязка Telegram из личного кабинета (`/api/v1/telegram/link`, 2.9.1·14).
 *
 * Отдельный контроллер от вебхука не случайно: **у них разная природа доверия**. Вебхук приходит
 * от Telegram и подтверждается секретным заголовком, здесь — обычный запрос нашего пользователя
 * под `AuthGuard`. Смешивать эти две границы в одном контроллере — верный способ однажды
 * защитить не то.
 */
@Controller('telegram/link')
export class TelegramLinkController {
  /**
   * @param _manageLink Use-case привязки.
   */
  public constructor(private readonly _manageLink: ManageTelegramLinkUseCase) {}

  /**
   * Состояние привязки текущего аккаунта.
   * @param request Запрос (аккаунт из Guard).
   * @returns Статус.
   */
  @Get()
  @UseGuards(AuthGuard)
  public async status(@Req() request: AuthenticatedRequest): Promise<TelegramLinkStatus> {
    return this._manageLink.getStatus(request.account.id);
  }

  /**
   * Выдаёт одноразовый код привязки.
   *
   * Ограничен по частоте: код открывает доступ к квоте приглашений аккаунта, и перебор здесь
   * дороже неудобства.
   * @param request Запрос (аккаунт из Guard).
   * @returns Код и срок жизни.
   */
  @Post('code')
  @UseGuards(AuthGuard)
  @RateLimit(5, 5 * 60 * 1000)
  public code(@Req() request: AuthenticatedRequest): TelegramLinkCodeView {
    return this._manageLink.issueCode(request.account.id);
  }

  /**
   * Отвязывает чат от аккаунта.
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения.
   */
  @Delete()
  @UseGuards(AuthGuard)
  @HttpCode(204)
  public async unlink(@Req() request: AuthenticatedRequest): Promise<void> {
    await this._manageLink.unlink(request.account.id);
  }
}

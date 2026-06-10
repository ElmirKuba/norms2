import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { ListNotificationsUseCase } from '../use-cases/list-notifications.use-case';
import { GetUnreadCountUseCase } from '../use-cases/get-unread-count.use-case';
import { MarkNotificationReadUseCase } from '../use-cases/mark-notification-read.use-case';
import { MarkAllNotificationsReadUseCase } from '../use-cases/mark-all-notifications-read.use-case';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import type { NotificationView } from '../interfaces/notification-view.interface';

/** Ответ счётчика непрочитанных. */
interface UnreadCountResponse {
  /** Число непрочитанных моих уведомлений. */
  count: number;
}

/**
 * Контроллер центра уведомлений (`/api/v1/notifications/*`) — всё под Guard
 * (уведомления адресные). Список + счётчик бейджа + отметки прочитанного.
 */
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  /**
   * @param _listNotificationsUseCase Список.
   * @param _getUnreadCountUseCase Счётчик непрочитанных.
   * @param _markNotificationReadUseCase Отметить одно.
   * @param _markAllNotificationsReadUseCase Отметить все.
   */
  public constructor(
    private readonly _listNotificationsUseCase: ListNotificationsUseCase,
    private readonly _getUnreadCountUseCase: GetUnreadCountUseCase,
    private readonly _markNotificationReadUseCase: MarkNotificationReadUseCase,
    private readonly _markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
  ) {}

  /**
   * Мои уведомления (broadcast + персональные), новые сверху, с флагом read.
   * @param request Запрос (аккаунт из Guard).
   * @returns Проекции.
   */
  @Get()
  public async list(@Req() request: AuthenticatedRequest): Promise<NotificationView[]> {
    return this._listNotificationsUseCase.execute(request.account.id);
  }

  /**
   * Число непрочитанных (для бейджа колокольчика).
   * @param request Запрос (аккаунт из Guard).
   * @returns { count }.
   */
  @Get('unread-count')
  public async unreadCount(@Req() request: AuthenticatedRequest): Promise<UnreadCountResponse> {
    return { count: await this._getUnreadCountUseCase.execute(request.account.id) };
  }

  /**
   * Отмечает одно уведомление прочитанным (idempotent, чужое — no-op).
   * @param id Уведомление.
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения (204).
   */
  @Post(':id/read')
  @HttpCode(204)
  public async markRead(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this._markNotificationReadUseCase.execute(request.account.id, id);
  }

  /**
   * Отмечает все мои непрочитанные прочитанными.
   * @param request Запрос (аккаунт из Guard).
   * @returns Промис завершения (204).
   */
  @Post('read-all')
  @HttpCode(204)
  public async markAllRead(@Req() request: AuthenticatedRequest): Promise<void> {
    await this._markAllNotificationsReadUseCase.execute(request.account.id);
  }
}

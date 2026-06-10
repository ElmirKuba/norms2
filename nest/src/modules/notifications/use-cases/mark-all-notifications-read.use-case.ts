import { Injectable } from '@nestjs/common';
import { NotificationDomainService } from '../domain-services/notification.domain-service';

/**
 * Use-case отметки всех моих непрочитанных прочитанными.
 */
@Injectable()
export class MarkAllNotificationsReadUseCase {
  /**
   * @param _notificationDomainService Domain-service уведомлений.
   */
  public constructor(private readonly _notificationDomainService: NotificationDomainService) {}

  /**
   * @param accountId Смотрящий (из Guard).
   * @returns Промис завершения.
   */
  public async execute(accountId: string): Promise<void> {
    await this._notificationDomainService.markAllRead(accountId);
  }
}

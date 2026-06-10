import { Injectable } from '@nestjs/common';
import { NotificationDomainService } from '../domain-services/notification.domain-service';

/**
 * Use-case отметки одного уведомления прочитанным. Idempotent; чужое — no-op.
 */
@Injectable()
export class MarkNotificationReadUseCase {
  /**
   * @param _notificationDomainService Domain-service уведомлений.
   */
  public constructor(private readonly _notificationDomainService: NotificationDomainService) {}

  /**
   * @param accountId Смотрящий (из Guard).
   * @param notificationId Уведомление.
   * @returns Промис завершения.
   */
  public async execute(accountId: string, notificationId: string): Promise<void> {
    await this._notificationDomainService.markRead(accountId, notificationId);
  }
}

import { Injectable } from '@nestjs/common';
import { NotificationDomainService } from '../domain-services/notification.domain-service';

/**
 * Use-case счётчика непрочитанных (бейдж колокольчика). Тонкая оркестрация.
 */
@Injectable()
export class GetUnreadCountUseCase {
  /**
   * @param _notificationDomainService Domain-service уведомлений.
   */
  public constructor(private readonly _notificationDomainService: NotificationDomainService) {}

  /**
   * @param accountId Смотрящий (из Guard).
   * @returns Число непрочитанных.
   */
  public async execute(accountId: string): Promise<number> {
    return this._notificationDomainService.countUnread(accountId);
  }
}

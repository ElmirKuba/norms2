import { Injectable } from '@nestjs/common';
import { NotificationDomainService } from '../domain-services/notification.domain-service';
import type { NotificationView } from '../interfaces/notification-view.interface';

/**
 * Use-case списка моих уведомлений (центр уведомлений). Тонкая оркестрация над
 * domain-service.
 */
@Injectable()
export class ListNotificationsUseCase {
  /**
   * @param _notificationDomainService Domain-service уведомлений.
   */
  public constructor(private readonly _notificationDomainService: NotificationDomainService) {}

  /**
   * @param accountId Смотрящий (из Guard).
   * @returns Мои уведомления с флагом read.
   */
  public async execute(accountId: string): Promise<NotificationView[]> {
    return this._notificationDomainService.list(accountId);
  }
}

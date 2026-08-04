import { Injectable } from '@nestjs/common';
import { NotificationDomainService } from '../domain-services/notification.domain-service';
import type { ReleaseView } from '../interfaces/release-view.interface';

/**
 * Use-case публичного списка релизов (`GET /releases`). Смотрящего нет —
 * витрина открыта всем, поэтому `accountId` в сигнатуре отсутствует, а не
 * передаётся пустым: аргумента, которого не существует, быть не должно.
 */
@Injectable()
export class ListPublicReleasesUseCase {
  /**
   * @param _notificationDomainService Domain-service уведомлений.
   */
  public constructor(private readonly _notificationDomainService: NotificationDomainService) {}

  /**
   * @returns Релизные ноты, новые сверху.
   */
  public async execute(): Promise<ReleaseView[]> {
    return this._notificationDomainService.listReleases();
  }
}

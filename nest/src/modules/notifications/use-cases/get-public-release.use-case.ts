import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationDomainService } from '../domain-services/notification.domain-service';
import type { ReleaseView } from '../interfaces/release-view.interface';

/**
 * Use-case одной публичной релиз-ноты (`GET /releases/:key`).
 *
 * 404 отдаётся одинаково и для несуществующего ключа, и для ключа персонального
 * уведомления: репозиторий ищет только среди `kind = 'release'`, поэтому «нет такой
 * ноты» и «эта нота не для витрины» снаружи неразличимы. Так и надо — иначе по
 * коду ответа можно было бы проверять существование чужих уведомлений.
 */
@Injectable()
export class GetPublicReleaseUseCase {
  /**
   * @param _notificationDomainService Domain-service уведомлений.
   */
  public constructor(private readonly _notificationDomainService: NotificationDomainService) {}

  /**
   * @param key Публичный ключ ноты (`release-2.9.0`).
   * @returns Проекция витрины.
   * @throws {NotFoundException} Если релизной ноты с таким ключом нет.
   */
  public async execute(key: string): Promise<ReleaseView> {
    const release = await this._notificationDomainService.findReleaseByKey(key);
    if (release === null) {
      throw new NotFoundException('Релиз не найден.');
    }
    return release;
  }
}

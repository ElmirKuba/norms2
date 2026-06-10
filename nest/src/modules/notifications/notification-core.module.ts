import { Module } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from './adapters/notification-repository.port';
import { NotificationRepository } from '../../database/repositories/notification/notification.repository';
import { NotificationDomainService } from './domain-services/notification.domain-service';
import { NotificationSeedService } from './seed/notification-seed.service';

/**
 * Ядро области notifications: `NotificationDomainService` + биндинг репозитория +
 * сид релиз-нот (`NotificationSeedService`, F7), БЕЗ зависимости от
 * `AccessControlModule`. Выделено, чтобы создавать персональные уведомления могли
 * другие области вниз (напр. `AuthModule` при регистрации по коду) без втягивания
 * контроллера/Guard и без цикла модулей (зеркало ADR-0038).
 */
@Module({
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: NotificationRepository },
    NotificationDomainService,
    NotificationSeedService,
  ],
  exports: [NotificationDomainService],
})
export class NotificationCoreModule {}

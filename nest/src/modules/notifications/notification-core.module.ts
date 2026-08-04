import { Module } from '@nestjs/common';
import { NOTIFICATION_REPOSITORY } from './adapters/notification-repository.port';
import { RELEASE_BROADCAST } from './adapters/release-broadcast.port';
import { LoggingReleaseBroadcastAdapter } from './adapters/logging-release-broadcast.adapter';
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
    // Вещание релизов наружу (2.9.1): пока логирующая заглушка. Появится Telegram-адаптер —
    // меняется ровно эта строка, остальной код о смене не узнает.
    { provide: RELEASE_BROADCAST, useClass: LoggingReleaseBroadcastAdapter },
    NotificationDomainService,
    NotificationSeedService,
  ],
  exports: [NotificationDomainService],
})
export class NotificationCoreModule {}

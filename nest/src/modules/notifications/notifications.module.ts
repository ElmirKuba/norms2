import { Module } from '@nestjs/common';
import { AccessControlModule } from '../auth/access-control.module';
import { NotificationCoreModule } from './notification-core.module';
import { NotificationsController } from './controllers/notifications.controller';
import { ReleasesController } from './controllers/releases.controller';
import { ListPublicReleasesUseCase } from './use-cases/list-public-releases.use-case';
import { GetPublicReleaseUseCase } from './use-cases/get-public-release.use-case';
import { ListNotificationsUseCase } from './use-cases/list-notifications.use-case';
import { GetUnreadCountUseCase } from './use-cases/get-unread-count.use-case';
import { MarkNotificationReadUseCase } from './use-cases/mark-notification-read.use-case';
import { MarkAllNotificationsReadUseCase } from './use-cases/mark-all-notifications-read.use-case';

/**
 * Модуль центра уведомлений (F5.6) и публичной витрины релизов (2.9.1·4):
 * контроллеры + use-cases над `NotificationCoreModule` (домен+репозиторий) и
 * `AccessControlModule` (Guard). Лист графа — никто его не импортирует, цикла нет.
 *
 * Контроллера два, и граница между ними — по доступу, а не по данным:
 * `NotificationsController` целиком под Guard (уведомления адресные),
 * `ReleasesController` целиком открыт (релиз-ноты публичны). Смешивать открытые и
 * закрытые ручки в одном контроллере не стали: тогда `@UseGuards` пришлось бы вешать
 * поштучно на методы, и первый же новый метод оказался бы открыт по умолчанию.
 */
@Module({
  imports: [AccessControlModule, NotificationCoreModule],
  controllers: [NotificationsController, ReleasesController],
  providers: [
    ListPublicReleasesUseCase,
    GetPublicReleaseUseCase,
    ListNotificationsUseCase,
    GetUnreadCountUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
  ],
})
export class NotificationsModule {}

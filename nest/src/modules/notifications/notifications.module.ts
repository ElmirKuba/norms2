import { Module } from '@nestjs/common';
import { AccessControlModule } from '../auth/access-control.module';
import { NotificationCoreModule } from './notification-core.module';
import { NotificationsController } from './controllers/notifications.controller';
import { ListNotificationsUseCase } from './use-cases/list-notifications.use-case';
import { GetUnreadCountUseCase } from './use-cases/get-unread-count.use-case';
import { MarkNotificationReadUseCase } from './use-cases/mark-notification-read.use-case';
import { MarkAllNotificationsReadUseCase } from './use-cases/mark-all-notifications-read.use-case';

/**
 * Модуль центра уведомлений (F5.6): контроллер + use-cases над
 * `NotificationCoreModule` (домен+репозиторий) и `AccessControlModule` (Guard).
 * Лист графа — никто его не импортирует, цикла нет.
 */
@Module({
  imports: [AccessControlModule, NotificationCoreModule],
  controllers: [NotificationsController],
  providers: [
    ListNotificationsUseCase,
    GetUnreadCountUseCase,
    MarkNotificationReadUseCase,
    MarkAllNotificationsReadUseCase,
  ],
})
export class NotificationsModule {}

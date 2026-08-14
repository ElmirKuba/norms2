import { Module } from '@nestjs/common';
import { TelegramCoreModule } from './telegram-core.module';
import { TelegramWebhookController } from './controllers/telegram-webhook.controller';
import { TelegramLinkController } from './controllers/telegram-link.controller';
import { ManageTelegramLinkUseCase } from './use-cases/manage-telegram-link.use-case';
import { GetTelegramPublicUseCase } from './use-cases/get-telegram-public.use-case';
import { LinkCodeStore } from './domain-services/link-code.store';
import { LinkWaitStore } from './domain-services/link-wait.store';
import { HandleTelegramUpdateUseCase } from './use-cases/handle-telegram-update.use-case';
import { OwnerActionsUseCase } from './use-cases/owner-actions.use-case';
import { ReviewRequestsUseCase } from './use-cases/review-requests.use-case';
import { RequestInvitesUseCase } from './use-cases/request-invites.use-case';
import { OwnerActionStore } from './domain-services/owner-action.store';
import { AccountModule } from '../account/account.module';
import { InvitesModule } from '../invites/invites.module';
import { AccessControlModule } from '../auth/access-control.module';
import { RequestUnbanUseCase } from './use-cases/request-unban.use-case';
import { BanCoreModule } from '../bans/ban-core.module';

/**
 * Модуль приёмной заявок (2.9.1·9): вебхук + use-case над ядром области.
 * Лист графа — никто его не импортирует, цикла нет.
 */
@Module({
  // `AccessControlModule`, а не `AuthModule` — он даёт `AuthGuard` для экрана привязки в ЛК и
  // не тянет за собой весь модуль авторизации (та же причина, что в `InvitesModule`).
  imports: [BanCoreModule, TelegramCoreModule, AccountModule, InvitesModule, AccessControlModule],
  controllers: [TelegramWebhookController, TelegramLinkController],
  providers: [
    RequestUnbanUseCase,
    HandleTelegramUpdateUseCase,
    OwnerActionsUseCase,
    ReviewRequestsUseCase,
    RequestInvitesUseCase,
    ManageTelegramLinkUseCase,
    GetTelegramPublicUseCase,
    OwnerActionStore,
    LinkCodeStore,
    LinkWaitStore,
  ],
  // Наружу — публичные строки области (для агрегатора `public-config`) и **ядро разбора заявок**
  // (2.9.3·11): админка обязана закрывать заявки ТЕМ ЖЕ кодом, что и бот, иначе два пути
  // решения разъедутся в мелочах и разойдутся молча. Цикла нет — telegram про admin не знает.
  exports: [GetTelegramPublicUseCase, ReviewRequestsUseCase],
})
export class TelegramModule {}

import { Module } from '@nestjs/common';
import { TelegramCoreModule } from './telegram-core.module';
import { TelegramWebhookController } from './controllers/telegram-webhook.controller';
import { TelegramLinkController } from './controllers/telegram-link.controller';
import { ManageTelegramLinkUseCase } from './use-cases/manage-telegram-link.use-case';
import { LinkCodeStore } from './domain-services/link-code.store';
import { HandleTelegramUpdateUseCase } from './use-cases/handle-telegram-update.use-case';
import { OwnerActionsUseCase } from './use-cases/owner-actions.use-case';
import { RequestInvitesUseCase } from './use-cases/request-invites.use-case';
import { OwnerActionStore } from './domain-services/owner-action.store';
import { AccountModule } from '../account/account.module';
import { InvitesModule } from '../invites/invites.module';
import { AccessControlModule } from '../auth/access-control.module';

/**
 * Модуль приёмной заявок (2.9.1·9): вебхук + use-case над ядром области.
 * Лист графа — никто его не импортирует, цикла нет.
 */
@Module({
  // `AccessControlModule`, а не `AuthModule` — он даёт `AuthGuard` для экрана привязки в ЛК и
  // не тянет за собой весь модуль авторизации (та же причина, что в `InvitesModule`).
  imports: [TelegramCoreModule, AccountModule, InvitesModule, AccessControlModule],
  controllers: [TelegramWebhookController, TelegramLinkController],
  providers: [
    HandleTelegramUpdateUseCase,
    OwnerActionsUseCase,
    RequestInvitesUseCase,
    ManageTelegramLinkUseCase,
    OwnerActionStore,
    LinkCodeStore,
  ],
})
export class TelegramModule {}

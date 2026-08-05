import { Module } from '@nestjs/common';
import { TelegramCoreModule } from './telegram-core.module';
import { TelegramWebhookController } from './controllers/telegram-webhook.controller';
import { HandleTelegramUpdateUseCase } from './use-cases/handle-telegram-update.use-case';
import { OwnerActionsUseCase } from './use-cases/owner-actions.use-case';
import { OwnerActionStore } from './domain-services/owner-action.store';
import { AccountModule } from '../account/account.module';
import { InvitesModule } from '../invites/invites.module';

/**
 * Модуль приёмной заявок (2.9.1·9): вебхук + use-case над ядром области.
 * Лист графа — никто его не импортирует, цикла нет.
 */
@Module({
  imports: [TelegramCoreModule, AccountModule, InvitesModule],
  controllers: [TelegramWebhookController],
  providers: [HandleTelegramUpdateUseCase, OwnerActionsUseCase, OwnerActionStore],
})
export class TelegramModule {}

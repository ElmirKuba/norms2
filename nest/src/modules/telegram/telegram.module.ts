import { Module } from '@nestjs/common';
import { TelegramCoreModule } from './telegram-core.module';
import { TelegramWebhookController } from './controllers/telegram-webhook.controller';
import { HandleTelegramUpdateUseCase } from './use-cases/handle-telegram-update.use-case';

/**
 * Модуль приёмной заявок (2.9.1·9): вебхук + use-case над ядром области.
 * Лист графа — никто его не импортирует, цикла нет.
 */
@Module({
  imports: [TelegramCoreModule],
  controllers: [TelegramWebhookController],
  providers: [HandleTelegramUpdateUseCase],
})
export class TelegramModule {}

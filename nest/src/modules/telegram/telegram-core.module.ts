import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { ADMIN_AUDIENCE } from './adapters/admin-audience.port';
import { RoleAdminAudienceAdapter } from './adapters/role-admin-audience.adapter';
import { TELEGRAM_REPOSITORY } from './adapters/telegram-repository.port';
import { TelegramRepository } from '../../database/repositories/telegram/telegram.repository';
import { TELEGRAM_API } from './adapters/telegram-api.port';
import { BotCommandsInitializer } from './domain-services/bot-commands.initializer';
import { TelegramApiAdapter } from './adapters/telegram-api.adapter';
import { TelegramDomainService } from './domain-services/telegram.domain-service';
import { RequestDraftStore } from './domain-services/request-draft.store';

/**
 * Ядро области telegram (2.9.1·8): биндинг порта репозитория на Drizzle-реализацию.
 *
 * Пока модуль только про данные — контроллер вебхука, диалог заявителя и сценарий владельца
 * появятся в ·9–·15. Заведён отдельно от `TelegramModule` по той же причине, что у
 * notifications: ядро смогут импортировать другие области (например `auth`, чтобы отметить
 * заявку исполненной после регистрации по коду), а контроллеры — не должны.
 */
@Module({
  // `AccountModule` — ради `ROLE_REPOSITORY`: с 2.9.3·3а права в боте определяет роль аккаунта,
  // а не `chat_id` из конфига. Зависимость идёт вниз (account о telegram не знает), цикла нет.
  imports: [AccountModule],
  providers: [
    { provide: TELEGRAM_REPOSITORY, useClass: TelegramRepository },
    { provide: TELEGRAM_API, useClass: TelegramApiAdapter },
    // Composition root области: «кто здесь админ» — порт, реализация подменяется одной строкой.
    { provide: ADMIN_AUDIENCE, useClass: RoleAdminAudienceAdapter },
    BotCommandsInitializer,
    RequestDraftStore,
    TelegramDomainService,
  ],
  exports: [TELEGRAM_REPOSITORY, TELEGRAM_API, ADMIN_AUDIENCE, TelegramDomainService],
})
export class TelegramCoreModule {}

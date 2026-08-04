import { Module } from '@nestjs/common';
import { TELEGRAM_REPOSITORY } from './adapters/telegram-repository.port';
import { TelegramRepository } from '../../database/repositories/telegram/telegram.repository';

/**
 * Ядро области telegram (2.9.1·8): биндинг порта репозитория на Drizzle-реализацию.
 *
 * Пока модуль только про данные — контроллер вебхука, диалог заявителя и сценарий владельца
 * появятся в ·9–·15. Заведён отдельно от `TelegramModule` по той же причине, что у
 * notifications: ядро смогут импортировать другие области (например `auth`, чтобы отметить
 * заявку исполненной после регистрации по коду), а контроллеры — не должны.
 */
@Module({
  providers: [{ provide: TELEGRAM_REPOSITORY, useClass: TelegramRepository }],
  exports: [TELEGRAM_REPOSITORY],
})
export class TelegramCoreModule {}

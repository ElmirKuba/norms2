import { Module } from '@nestjs/common';
import { AppConfigModule } from './system/config/config.module';
import { LoggingModule } from './system/logging/logging.module';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './database/client/database.module';
import { HealthModule } from './modules/health/health.module';
import { AccountModule } from './modules/account/account.module';

/**
 * Корневой модуль приложения: конфиг (zod, fail-fast), логирование (pino),
 * общие сервисы (shared), БД (Drizzle), health и доменная область account.
 * Прочие области (auth, invites, ...) добавятся далее.
 */
@Module({
  imports: [AppConfigModule, LoggingModule, SharedModule, DatabaseModule, HealthModule, AccountModule],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { AppConfigModule } from './system/config/config.module';
import { LoggingModule } from './system/logging/logging.module';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './database/client/database.module';
import { HealthModule } from './modules/health/health.module';

/**
 * Корневой модуль приложения: конфиг (zod, fail-fast), логирование (pino),
 * общие сервисы (shared), БД (Drizzle) и health. Бизнес-модули областей
 * (account, auth, invites, ...) добавятся далее.
 */
@Module({
  imports: [AppConfigModule, LoggingModule, SharedModule, DatabaseModule, HealthModule],
})
export class AppModule {}

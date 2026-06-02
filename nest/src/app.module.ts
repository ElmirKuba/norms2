import { Module } from '@nestjs/common';
import { AppConfigModule } from './system/config/config.module';
import { LoggingModule } from './system/logging/logging.module';
import { DatabaseModule } from './system/database/database.module';
import { HealthModule } from './controllers/health/health.module';

/**
 * Корневой модуль приложения: конфиг (zod, fail-fast), логирование (pino),
 * БД (Drizzle) и health-проверка. Бизнес-модули областей (auth, invites, ...)
 * добавятся далее.
 */
@Module({
  imports: [AppConfigModule, LoggingModule, DatabaseModule, HealthModule],
})
export class AppModule {}

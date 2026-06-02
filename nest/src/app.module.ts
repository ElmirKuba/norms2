import { Module } from '@nestjs/common';
import { AppConfigModule } from './system/config/config.module';
import { DatabaseModule } from './system/database/database.module';
import { HealthModule } from './controllers/health/health.module';

/**
 * Корневой модуль приложения: подключает конфиг (zod, fail-fast), БД (Drizzle)
 * и health-проверку. Бизнес-модули областей (auth, invites, ...) добавятся далее.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule],
})
export class AppModule {}

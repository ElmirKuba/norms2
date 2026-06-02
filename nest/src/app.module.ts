import { Module } from '@nestjs/common';
import { AppConfigModule } from './system/config/config.module';
import { DatabaseModule } from './system/database/database.module';

/**
 * Корневой модуль приложения: подключает конфиг (zod, fail-fast) и БД (Drizzle).
 * Бизнес-модули областей (auth, invites, ...) добавятся в следующих этапах.
 */
@Module({
  imports: [AppConfigModule, DatabaseModule],
})
export class AppModule {}

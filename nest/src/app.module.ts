import { Module } from '@nestjs/common';
import { AppConfigModule } from './system/config/config.module';
import { LoggingModule } from './system/logging/logging.module';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './database/client/database.module';
import { HealthModule } from './modules/health/health.module';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { InvitesModule } from './modules/invites/invites.module';

/**
 * Корневой модуль приложения: конфиг (zod, fail-fast), логирование (pino),
 * общие сервисы (shared), БД (Drizzle), health и доменные области
 * account/auth/invites. Прочие (bans, ...) добавятся далее.
 */
@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    SharedModule,
    DatabaseModule,
    HealthModule,
    AccountModule,
    AuthModule,
    InvitesModule,
  ],
})
export class AppModule {}

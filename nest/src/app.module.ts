import { Module } from '@nestjs/common';
import { AppConfigModule } from './system/config/config.module';
import { LoggingModule } from './system/logging/logging.module';
import { SharedModule } from './shared/shared.module';
import { DatabaseModule } from './database/client/database.module';
import { HealthModule } from './modules/health/health.module';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { InvitesModule } from './modules/invites/invites.module';
import { BansModule } from './modules/bans/bans.module';
import { RecoveryModule } from './modules/recovery/recovery.module';
import { ProfileModule } from './modules/profile/profile.module';

/**
 * Корневой модуль приложения: конфиг (zod, fail-fast), логирование (pino),
 * общие сервисы (shared), БД (Drizzle), health и доменные области
 * account/auth/invites/bans/recovery/profile.
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
    BansModule,
    RecoveryModule,
    ProfileModule,
  ],
})
export class AppModule {}

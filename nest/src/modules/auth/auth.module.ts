import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccountModule } from '../account/account.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthController } from './controllers/auth.controller';
import { FeatureFlagsController } from './controllers/feature-flags.controller';
import { AccessTokenService } from './services/access-token.service';
import { AuthGuard } from './guards/auth.guard';
import { RegisterAccountUseCase } from './use-cases/register-account.use-case';
import { GetFeatureFlagsUseCase } from './use-cases/get-feature-flags.use-case';
import { GetRegistrationModeUseCase } from './use-cases/get-registration-mode.use-case';
import { LoginAccountUseCase } from './use-cases/login-account.use-case';
import { RefreshTokensUseCase } from './use-cases/refresh-tokens.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';
import type { Env } from '../../system/config/env.schema';

/**
 * Модуль области auth: контроллеры + use-cases (регистрация/режим/флаги/вход/
 * refresh/logout) + access-токен + Guard. Импортирует `AccountModule` и
 * `SessionsModule` — для кросс-доменных вызовов ВНИЗ (ADR-0030). `JwtModule`
 * настроен из конфига (`JWT_ACCESS_SECRET`/`ACCESS_TTL`). Экспортит `AuthGuard`
 * (+ его зависимости `AccessTokenService` и реэкспорт `JwtModule`) — guard,
 * привязанный через `@UseGuards` в контроллере чужого модуля, инстанцируется в
 * DI-скоупе ТОГО модуля, поэтому его зависимости обязаны резолвиться там же.
 */
@Module({
  imports: [
    AccountModule,
    SessionsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Env, true>) => ({
        secret: configService.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { expiresIn: configService.get('ACCESS_TTL', { infer: true }) },
      }),
    }),
  ],
  controllers: [AuthController, FeatureFlagsController],
  providers: [
    AccessTokenService,
    AuthGuard,
    RegisterAccountUseCase,
    GetFeatureFlagsUseCase,
    GetRegistrationModeUseCase,
    LoginAccountUseCase,
    RefreshTokensUseCase,
    LogoutUseCase,
  ],
  exports: [AuthGuard, AccessTokenService, JwtModule],
})
export class AuthModule {}

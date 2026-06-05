import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { SessionsModule } from '../sessions/sessions.module';
import { InvitesModule } from '../invites/invites.module';
import { AccessControlModule } from './access-control.module';
import { AuthController } from './controllers/auth.controller';
import { FeatureFlagsController } from './controllers/feature-flags.controller';
import { RegisterAccountUseCase } from './use-cases/register-account.use-case';
import { GetFeatureFlagsUseCase } from './use-cases/get-feature-flags.use-case';
import { GetRegistrationModeUseCase } from './use-cases/get-registration-mode.use-case';
import { LoginAccountUseCase } from './use-cases/login-account.use-case';
import { RefreshTokensUseCase } from './use-cases/refresh-tokens.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';

/**
 * Модуль auth-флоу: контроллеры + use-cases (регистрация/режим/флаги/вход/refresh/
 * logout). Кросс-домен ВНИЗ (ADR-0030): зовёт domain-services областей `account`,
 * `sessions`, `invites` (регистрация по инвайту — `AccessControlModule` даёт
 * `AccessTokenService` для выдачи access-токена). Контроль доступа (guard) вынесен
 * в `AccessControlModule` — чтобы invites импортировал guard без цикла с auth
 * (ADR-0037).
 */
@Module({
  imports: [AccessControlModule, AccountModule, SessionsModule, InvitesModule],
  controllers: [AuthController, FeatureFlagsController],
  providers: [
    RegisterAccountUseCase,
    GetFeatureFlagsUseCase,
    GetRegistrationModeUseCase,
    LoginAccountUseCase,
    RefreshTokensUseCase,
    LogoutUseCase,
  ],
})
export class AuthModule {}

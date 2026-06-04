import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AuthController } from './controllers/auth.controller';
import { FeatureFlagsController } from './controllers/feature-flags.controller';
import { RegisterAccountUseCase } from './use-cases/register-account.use-case';
import { GetFeatureFlagsUseCase } from './use-cases/get-feature-flags.use-case';
import { GetRegistrationModeUseCase } from './use-cases/get-registration-mode.use-case';

/**
 * Модуль области auth: контроллеры + use-cases регистрации/режима/флагов.
 * Импортирует `AccountModule` — чтобы `RegisterAccountUseCase` мог звать
 * `AccountDomainService` ВНИЗ (кросс-домен, ADR-0030). ConfigService — глобальный.
 */
@Module({
  imports: [AccountModule],
  controllers: [AuthController, FeatureFlagsController],
  providers: [RegisterAccountUseCase, GetFeatureFlagsUseCase, GetRegistrationModeUseCase],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AccessControlModule } from '../auth/access-control.module';
import { ProfileController } from './controllers/profile.controller';
import { GetProfileByLoginUseCase } from './use-cases/get-profile-by-login.use-case';
import { UpdateAliasUseCase } from './use-cases/update-alias.use-case';

/**
 * Фича-модуль profile: HTTP-доступ к профилю поверх домена account. Вынесен из
 * `account.module` (тот pure-domain, импортируется всеми → контроллер+Guard в нём
 * замкнул бы цикл с `AccessControlModule`). Импортирует `AccountModule`
 * (кросс-домен вниз) и `AccessControlModule` (Guard).
 */
@Module({
  imports: [AccountModule, AccessControlModule],
  controllers: [ProfileController],
  providers: [GetProfileByLoginUseCase, UpdateAliasUseCase],
})
export class ProfileModule {}

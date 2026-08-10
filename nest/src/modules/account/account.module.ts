import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from './adapters/account-repository.port';
import { ROLE_REPOSITORY } from './adapters/role-repository.port';
import { AccountRepository } from '../../database/repositories/account/account.repository';
import { RoleRepository } from '../../database/repositories/account/role.repository';
import { AccountDomainService } from './domain-services/account.domain-service';
import { RoleSeedService } from './seed/role-seed.service';

/**
 * Модуль области account — composition root фичи: биндит DI-токены портов
 * (`ACCOUNT_REPOSITORY`, `ROLE_REPOSITORY` — 2.9.3) на Drizzle-реализации из `database/`,
 * предоставляет `AccountDomainService` и экспортирует его для кросс-доменных вызовов
 * (напр. auth-use-case зовёт его вниз). Связь домен↔инфра живёт ТОЛЬКО здесь.
 *
 * `RoleSeedService` заводит справочник ролей и назначает администраторов на старте (2.9.3·2).
 * Порт ролей экспортируется: проверка прав (·3) и админка (·5) живут в других модулях, а
 * лезть в `database/` напрямую им нельзя.
 */
@Module({
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: AccountRepository },
    { provide: ROLE_REPOSITORY, useClass: RoleRepository },
    AccountDomainService,
    RoleSeedService,
  ],
  exports: [AccountDomainService, ROLE_REPOSITORY],
})
export class AccountModule {}

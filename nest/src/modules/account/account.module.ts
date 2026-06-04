import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from './adapters/account-repository.port';
import { AccountRepository } from '../../database/repositories/account/account.repository';
import { AccountDomainService } from './domain-services/account.domain-service';

/**
 * Модуль области account — composition root фичи: биндит DI-токен порта
 * `ACCOUNT_REPOSITORY` на Drizzle-реализацию `AccountRepository` (из database/),
 * предоставляет `AccountDomainService` и экспортирует его для кросс-доменных
 * вызовов (напр. auth-use-case зовёт его вниз). Связь домен↔инфра живёт ТОЛЬКО здесь.
 */
@Module({
  providers: [
    { provide: ACCOUNT_REPOSITORY, useClass: AccountRepository },
    AccountDomainService,
  ],
  exports: [AccountDomainService],
})
export class AccountModule {}

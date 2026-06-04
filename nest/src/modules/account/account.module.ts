import { Module } from '@nestjs/common';
import { ACCOUNT_REPOSITORY } from './adapters/account-repository.port';
import { AccountRepository } from '../../database/repositories/account/account.repository';

/**
 * Модуль области account — composition root фичи: биндит DI-токен порта
 * `ACCOUNT_REPOSITORY` на Drizzle-реализацию `AccountRepository` (из database/) и
 * экспортирует токен. Доменные слои (свои и кросс-доменные) инъектят порт по
 * токену, не зная про реализацию. Связь домен↔инфра живёт ТОЛЬКО здесь.
 * Домен-сервисы/use-cases/контроллер добавятся на A2/A3.
 */
@Module({
  providers: [{ provide: ACCOUNT_REPOSITORY, useClass: AccountRepository }],
  exports: [ACCOUNT_REPOSITORY],
})
export class AccountModule {}

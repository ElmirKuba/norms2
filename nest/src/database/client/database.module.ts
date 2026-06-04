import { Global, Module } from '@nestjs/common';
import { DRIZZLE } from './database.constants';
import type { DrizzleDatabase } from './database.constants';
import { DatabaseService } from './database.service';
import { DrizzleTransactionRunner } from './transaction-runner';
import { TRANSACTION_RUNNER } from '../../shared/transactions/transaction-runner.port';

/**
 * Глобальный модуль БД: предоставляет DatabaseService, DI-токен DRIZZLE и
 * TRANSACTION_RUNNER (раннер транзакций) для слоя репозиториев всех областей.
 */
@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: DRIZZLE,
      inject: [DatabaseService],
      useFactory: (databaseService: DatabaseService): DrizzleDatabase => databaseService.db,
    },
    { provide: TRANSACTION_RUNNER, useClass: DrizzleTransactionRunner },
  ],
  exports: [DatabaseService, DRIZZLE, TRANSACTION_RUNNER],
})
export class DatabaseModule {}

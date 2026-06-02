import { Global, Module } from '@nestjs/common';
import { DRIZZLE } from './database.constants';
import type { DrizzleDatabase } from './database.constants';
import { DatabaseService } from './database.service';

/**
 * Глобальный модуль БД: предоставляет DatabaseService и DI-токен DRIZZLE
 * (готовый инстанс Drizzle) для слоя репозиториев всех областей.
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
  ],
  exports: [DatabaseService, DRIZZLE],
})
export class DatabaseModule {}

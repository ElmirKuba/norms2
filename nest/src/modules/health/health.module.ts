import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { GetHealthUseCase } from './use-cases/get-health.use-case';
import { GetReadinessUseCase } from './use-cases/get-readiness.use-case';
import { DB_HEALTH } from './adapters/db-health.port';
import { DatabaseService } from '../../database/client/database.service';

/**
 * Модуль health-проверки: контроллер + use-cases liveness/readiness. Биндит порт
 * `DB_HEALTH` на глобальный `DatabaseService` (useExisting) — readiness зависит
 * от порта, не от конкретной реализации.
 */
@Module({
  controllers: [HealthController],
  providers: [
    GetHealthUseCase,
    GetReadinessUseCase,
    { provide: DB_HEALTH, useExisting: DatabaseService },
  ],
})
export class HealthModule {}

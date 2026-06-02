import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { GetHealthUseCase } from './use-cases/get-health.use-case';
import { GetReadinessUseCase } from './use-cases/get-readiness.use-case';

/**
 * Модуль health-проверки: контроллер + use-cases liveness/readiness.
 * DatabaseService для readiness берётся из глобального DatabaseModule.
 */
@Module({
  controllers: [HealthController],
  providers: [GetHealthUseCase, GetReadinessUseCase],
})
export class HealthModule {}

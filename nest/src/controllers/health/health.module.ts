import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { GetHealthUseCase } from '../../use-cases/health/get-health.use-case';

/**
 * Модуль health-проверки: контроллер + use-case живости.
 */
@Module({
  controllers: [HealthController],
  providers: [GetHealthUseCase],
})
export class HealthModule {}

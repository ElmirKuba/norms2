import { Module } from '@nestjs/common';
import { ACCENT_GOAL_REPOSITORY } from './adapters/accent-goal-repository.port';
import { AccentGoalRepository } from '../../../database/repositories/accent/accent-goal.repository';
import { AccentGoalDomainService } from './domain-services/accent-goal.domain-service';

/**
 * Область целей раздела «Акцент» (мультимодуль, ADR-0050; подфаза 2.5). Порт
 * `ACCENT_GOAL_REPOSITORY` → Drizzle-репо (·3) + `AccentGoalDomainService` (·4: CRUD +
 * инварианты direction/глубины, ADR-0052). Use-cases + контроллер `/accent/goals` под
 * AuthGuard — на ·5–·6; вычисляемый прогресс/forecast — ·9. Агрегаты вычисляемы → без
 * version. Domain-service экспортится для кросс-домена вниз (привычка→прогресс цели, 2.5·13).
 */
@Module({
  providers: [
    { provide: ACCENT_GOAL_REPOSITORY, useClass: AccentGoalRepository },
    AccentGoalDomainService,
  ],
  exports: [AccentGoalDomainService],
})
export class GoalsModule {}

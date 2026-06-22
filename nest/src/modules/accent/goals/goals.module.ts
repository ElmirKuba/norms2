import { Module } from '@nestjs/common';
import { ACCENT_GOAL_REPOSITORY } from './adapters/accent-goal-repository.port';
import { AccentGoalRepository } from '../../../database/repositories/accent/accent-goal.repository';

/**
 * Область целей раздела «Акцент» (мультимодуль, ADR-0050; подфаза 2.5). Каркас (·3):
 * порт `ACCENT_GOAL_REPOSITORY` → Drizzle-репо. Domain-service (CRUD + инварианты
 * direction/глубины + вычисляемый прогресс, ADR-0052), use-cases и контроллер
 * `/accent/goals` под AuthGuard — на ·4–·6. Агрегаты вычисляемы → без version.
 */
@Module({
  providers: [{ provide: ACCENT_GOAL_REPOSITORY, useClass: AccentGoalRepository }],
})
export class GoalsModule {}

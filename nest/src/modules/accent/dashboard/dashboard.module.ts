import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { AntiHabitsModule } from '../anti-habits/anti-habits.module';
import { GoalsModule } from '../goals/goals.module';
import { HabitsModule } from '../habits/habits.module';
import { MicroWinsModule } from '../micro-wins/micro-wins.module';
import { ObstaclesModule } from '../obstacles/obstacles.module';
import { AccentSettingsModule } from '../settings/accent-settings.module';
import { DashboardController } from './controllers/dashboard.controller';
import { AccentNowDomainService } from './domain-services/accent-now.domain-service';
import { GetDashboardUseCase } from './use-cases/get-dashboard.use-case';

/**
 * Дашборд (2.11) — единственный модуль раздела, который **читает соседей**: собирает снимок дня
 * из их domain-services (кросс-домен вниз, [ADR-0030](../../../../docs/decisions/0030-stack-revision-drizzle-5layer-npm.md)).
 * Своих таблиц у него нет и не планируется: дашборд ничего не хранит, только показывает.
 */
@Module({
  imports: [
    AccessControlModule,
    HabitsModule,
    GoalsModule,
    AntiHabitsModule,
    MicroWinsModule,
    ObstaclesModule,
    AccentSettingsModule,
  ],
  controllers: [DashboardController],
  providers: [GetDashboardUseCase, AccentNowDomainService],
})
export class DashboardModule {}

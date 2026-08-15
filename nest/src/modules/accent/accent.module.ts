import { Module } from '@nestjs/common';
import { AccentSettingsModule } from './settings/accent-settings.module';
import { AccentReferenceModule } from './reference/accent-reference.module';
import { MicroWinsModule } from './micro-wins/micro-wins.module';
import { TodosModule } from './todos/todos.module';
import { HabitsModule } from './habits/habits.module';
import { GoalsModule } from './goals/goals.module';
import { AntiHabitsModule } from './anti-habits/anti-habits.module';
import { ObstaclesModule } from './obstacles/obstacles.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ProgressModule } from './progress/progress.module';

/**
 * Зонтик раздела «Акцент» (фаза 2, мультимодуль — ADR-0050): импортит area-модули
 * («область = свой модуль», как фаза 1), чтобы `AppModule` оставался чистым. По
 * подфазам сюда добавятся следующие area-модули (после `ObstaclesModule` 2.7).
 * Все сущности раздела — на `account_id` фазы 1 (отдельного User нет, ADR-0027).
 * Имена — ADR-0047. Кросс-домен/кросс-фаза — только вниз через domain-service.
 */
@Module({
  imports: [
    AccentSettingsModule,
    AccentReferenceModule,
    MicroWinsModule,
    TodosModule,
    HabitsModule,
    GoalsModule,
    AntiHabitsModule,
    ObstaclesModule,
    DashboardModule,
    ProgressModule,
  ],
})
export class AccentModule {}

import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { GoalsModule } from '../goals/goals.module';
import { ACCENT_HABIT_REPOSITORY } from './adapters/accent-habit-repository.port';
import { AccentHabitRepository } from '../../../database/repositories/accent/accent-habit.repository';
import { ACCENT_TASK_REPOSITORY } from './adapters/accent-task-repository.port';
import { AccentTaskRepository } from '../../../database/repositories/accent/accent-task.repository';
import { AccentHabitDomainService } from './domain-services/accent-habit.domain-service';
import { AccentTaskDomainService } from './domain-services/accent-task.domain-service';
import { AccentLadderEngine } from './domain-services/accent-ladder-engine.domain-service';
import { HabitsController } from './controllers/habits.controller';
import { TasksController } from './controllers/tasks.controller';
import { ListHabitsUseCase } from './use-cases/list-habits.use-case';
import { GetHabitUseCase } from './use-cases/get-habit.use-case';
import { CreateHabitUseCase } from './use-cases/create-habit.use-case';
import { UpdateHabitUseCase } from './use-cases/update-habit.use-case';
import { DeactivateHabitUseCase } from './use-cases/deactivate-habit.use-case';
import { SeedHabitStarterPackUseCase } from './use-cases/seed-habit-starter-pack.use-case';
import { ClearHabitStartersUseCase } from './use-cases/clear-habit-starters.use-case';
import { AdoptHabitUseCase } from './use-cases/adopt-habit.use-case';
import { ReorderHabitsUseCase } from './use-cases/reorder-habits.use-case';
import { ListTasksUseCase } from './use-cases/list-tasks.use-case';
import { ListOverdueTasksUseCase } from './use-cases/list-overdue-tasks.use-case';
import { ListDueTodayTasksUseCase } from './use-cases/list-due-today-tasks.use-case';
import { CreateOneOffTaskUseCase } from './use-cases/create-one-off-task.use-case';
import { CompleteTaskUseCase } from './use-cases/complete-task.use-case';
import { UncompleteTaskUseCase } from './use-cases/uncomplete-task.use-case';
import { PostponeTaskUseCase } from './use-cases/postpone-task.use-case';

/**
 * Область привычек раздела «Акцент» (мультимодуль, ADR-0050; «сердце продукта», 2.4):
 * порт `ACCENT_HABIT_REPOSITORY` → Drizzle-репо, `AccentHabitDomainService` (CRUD +
 * инварианты лесенки), контроллер `/accent/habits` под AuthGuard (импорт
 * `AccessControlModule`) + тонкие use-cases. Задачи/материализация/лесенка — 2.4·6+.
 * Экспортит domain-service для кросс-домена вниз (материализация задач, цели 2.5).
 */
@Module({
  imports: [AccessControlModule, GoalsModule],
  controllers: [HabitsController, TasksController],
  providers: [
    { provide: ACCENT_HABIT_REPOSITORY, useClass: AccentHabitRepository },
    { provide: ACCENT_TASK_REPOSITORY, useClass: AccentTaskRepository },
    AccentHabitDomainService,
    AccentTaskDomainService,
    AccentLadderEngine,
    ListHabitsUseCase,
    GetHabitUseCase,
    CreateHabitUseCase,
    UpdateHabitUseCase,
    DeactivateHabitUseCase,
    SeedHabitStarterPackUseCase,
    ClearHabitStartersUseCase,
    AdoptHabitUseCase,
    ReorderHabitsUseCase,
    ListTasksUseCase,
    ListOverdueTasksUseCase,
    ListDueTodayTasksUseCase,
    CreateOneOffTaskUseCase,
    CompleteTaskUseCase,
    UncompleteTaskUseCase,
    PostponeTaskUseCase,
  ],
  exports: [AccentHabitDomainService],
})
export class HabitsModule {}

import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { ACCENT_HABIT_REPOSITORY } from './adapters/accent-habit-repository.port';
import { AccentHabitRepository } from '../../../database/repositories/accent/accent-habit.repository';
import { ACCENT_TASK_REPOSITORY } from './adapters/accent-task-repository.port';
import { AccentTaskRepository } from '../../../database/repositories/accent/accent-task.repository';
import { AccentHabitDomainService } from './domain-services/accent-habit.domain-service';
import { AccentTaskDomainService } from './domain-services/accent-task.domain-service';
import { HabitsController } from './controllers/habits.controller';
import { ListHabitsUseCase } from './use-cases/list-habits.use-case';
import { GetHabitUseCase } from './use-cases/get-habit.use-case';
import { CreateHabitUseCase } from './use-cases/create-habit.use-case';
import { UpdateHabitUseCase } from './use-cases/update-habit.use-case';
import { DeactivateHabitUseCase } from './use-cases/deactivate-habit.use-case';

/**
 * Область привычек раздела «Акцент» (мультимодуль, ADR-0050; «сердце продукта», 2.4):
 * порт `ACCENT_HABIT_REPOSITORY` → Drizzle-репо, `AccentHabitDomainService` (CRUD +
 * инварианты лесенки), контроллер `/accent/habits` под AuthGuard (импорт
 * `AccessControlModule`) + тонкие use-cases. Задачи/материализация/лесенка — 2.4·6+.
 * Экспортит domain-service для кросс-домена вниз (материализация задач, цели 2.5).
 */
@Module({
  imports: [AccessControlModule],
  controllers: [HabitsController],
  providers: [
    { provide: ACCENT_HABIT_REPOSITORY, useClass: AccentHabitRepository },
    { provide: ACCENT_TASK_REPOSITORY, useClass: AccentTaskRepository },
    AccentHabitDomainService,
    AccentTaskDomainService,
    ListHabitsUseCase,
    GetHabitUseCase,
    CreateHabitUseCase,
    UpdateHabitUseCase,
    DeactivateHabitUseCase,
  ],
  exports: [AccentHabitDomainService],
})
export class HabitsModule {}

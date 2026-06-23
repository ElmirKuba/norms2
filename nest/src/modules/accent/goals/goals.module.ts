import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { ACCENT_GOAL_REPOSITORY } from './adapters/accent-goal-repository.port';
import { AccentGoalRepository } from '../../../database/repositories/accent/accent-goal.repository';
import { ACCENT_GOAL_ENTRY_REPOSITORY } from './adapters/accent-goal-entry-repository.port';
import { AccentGoalEntryRepository } from '../../../database/repositories/accent/accent-goal-entry.repository';
import { ACCENT_MILESTONE_REPOSITORY } from './adapters/accent-milestone-repository.port';
import { AccentMilestoneRepository } from '../../../database/repositories/accent/accent-milestone.repository';
import { AccentGoalDomainService } from './domain-services/accent-goal.domain-service';
import { GoalsController } from './controllers/goals.controller';
import { ListGoalsUseCase } from './use-cases/list-goals.use-case';
import { GetGoalUseCase } from './use-cases/get-goal.use-case';
import { CreateGoalUseCase } from './use-cases/create-goal.use-case';
import { UpdateGoalUseCase } from './use-cases/update-goal.use-case';
import { ArchiveGoalUseCase } from './use-cases/archive-goal.use-case';
import { RestoreGoalUseCase } from './use-cases/restore-goal.use-case';
import { PauseGoalUseCase } from './use-cases/pause-goal.use-case';
import { ResumeGoalUseCase } from './use-cases/resume-goal.use-case';
import { AddGoalEntryUseCase } from './use-cases/add-goal-entry.use-case';
import { ListGoalEntriesUseCase } from './use-cases/list-goal-entries.use-case';
import { AddMilestoneUseCase } from './use-cases/add-milestone.use-case';
import { ListMilestonesUseCase } from './use-cases/list-milestones.use-case';
import { RemoveMilestoneUseCase } from './use-cases/remove-milestone.use-case';
import { ListChildGoalsUseCase } from './use-cases/list-child-goals.use-case';

/**
 * Область целей раздела «Акцент» (мультимодуль, ADR-0050; подфаза 2.5). Порт
 * `ACCENT_GOAL_REPOSITORY` → Drizzle-репо (·3) + `AccentGoalDomainService` (·4–·5:
 * CRUD + инварианты direction/глубины + lifecycle) + контроллер `/accent/goals` под
 * AuthGuard (импорт `AccessControlModule`) + тонкие use-cases (·6). Вычисляемый прогресс/
 * forecast — ·9; записи/вехи/подцели — ·7–·12. Агрегаты вычисляемы → без version.
 * Domain-service экспортится для кросс-домена вниз (привычка→прогресс цели, 2.5·13).
 */
@Module({
  imports: [AccessControlModule],
  controllers: [GoalsController],
  providers: [
    { provide: ACCENT_GOAL_REPOSITORY, useClass: AccentGoalRepository },
    { provide: ACCENT_GOAL_ENTRY_REPOSITORY, useClass: AccentGoalEntryRepository },
    { provide: ACCENT_MILESTONE_REPOSITORY, useClass: AccentMilestoneRepository },
    AccentGoalDomainService,
    ListGoalsUseCase,
    GetGoalUseCase,
    CreateGoalUseCase,
    UpdateGoalUseCase,
    ArchiveGoalUseCase,
    RestoreGoalUseCase,
    PauseGoalUseCase,
    ResumeGoalUseCase,
    AddGoalEntryUseCase,
    ListGoalEntriesUseCase,
    AddMilestoneUseCase,
    ListMilestonesUseCase,
    RemoveMilestoneUseCase,
    ListChildGoalsUseCase,
  ],
  exports: [AccentGoalDomainService],
})
export class GoalsModule {}

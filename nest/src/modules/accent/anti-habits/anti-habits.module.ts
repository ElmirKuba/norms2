import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { ACCENT_ANTI_HABIT_REPOSITORY } from './adapters/accent-anti-habit-repository.port';
import { AccentAntiHabitRepository } from '../../../database/repositories/accent/accent-anti-habit.repository';
import { ACCENT_ANTI_HABIT_RELAPSE_REPOSITORY } from './adapters/accent-anti-habit-relapse-repository.port';
import { AccentAntiHabitRelapseRepository } from '../../../database/repositories/accent/accent-anti-habit-relapse.repository';
import { ACCENT_ANTI_HABIT_EVENTS } from './adapters/accent-anti-habit-events.port';
import { LoggingAntiHabitEventsAdapter } from './adapters/logging-anti-habit-events.adapter';
import { AccentAntiHabitDomainService } from './domain-services/accent-anti-habit.domain-service';
import { AntiHabitsController } from './controllers/anti-habits.controller';
import { ListAntiHabitsUseCase } from './use-cases/list-anti-habits.use-case';
import { CreateAntiHabitUseCase } from './use-cases/create-anti-habit.use-case';
import { GetAntiHabitUseCase } from './use-cases/get-anti-habit.use-case';
import { UpdateAntiHabitUseCase } from './use-cases/update-anti-habit.use-case';
import { RelapseAntiHabitUseCase } from './use-cases/relapse-anti-habit.use-case';
import { ListAntiHabitRelapsesUseCase } from './use-cases/list-anti-habit-relapses.use-case';

/**
 * Область анти-привычек «держусь» раздела «Акцент» (мультимодуль, ADR-0050; подфаза 2.6).
 * Composition root: биндит порты `ACCENT_ANTI_HABIT_REPOSITORY`/`…_RELAPSE_REPOSITORY` →
 * Drizzle-репо и `ACCENT_ANTI_HABIT_EVENTS` → логирующий адаптер (2.9 подменит на реальную
 * шину/начисление). `AccentAntiHabitDomainService` (CRUD + рецидив CAS-first, ADR-0035) +
 * контроллер `/accent/anti-habits` под AuthGuard (импорт `AccessControlModule`) + тонкие
 * use-cases. Геймификация (очки/вехи серий) — 2.9 через события-хуки.
 */
@Module({
  imports: [AccessControlModule],
  controllers: [AntiHabitsController],
  providers: [
    { provide: ACCENT_ANTI_HABIT_REPOSITORY, useClass: AccentAntiHabitRepository },
    { provide: ACCENT_ANTI_HABIT_RELAPSE_REPOSITORY, useClass: AccentAntiHabitRelapseRepository },
    { provide: ACCENT_ANTI_HABIT_EVENTS, useClass: LoggingAntiHabitEventsAdapter },
    AccentAntiHabitDomainService,
    ListAntiHabitsUseCase,
    CreateAntiHabitUseCase,
    GetAntiHabitUseCase,
    UpdateAntiHabitUseCase,
    RelapseAntiHabitUseCase,
    ListAntiHabitRelapsesUseCase,
  ],
})
export class AntiHabitsModule {}

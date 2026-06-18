import { Module } from '@nestjs/common';
import { ACCENT_HABIT_REPOSITORY } from './adapters/accent-habit-repository.port';
import { AccentHabitRepository } from '../../../database/repositories/accent/accent-habit.repository';
import { AccentHabitDomainService } from './domain-services/accent-habit.domain-service';

/**
 * Область привычек раздела «Акцент» (мультимодуль, ADR-0050; «сердце продукта», 2.4):
 * порт `ACCENT_HABIT_REPOSITORY` → Drizzle-репо, `AccentHabitDomainService` (CRUD +
 * инварианты лесенки). Контроллер/API — 2.4·5; задачи/материализация/лесенка — 2.4·6+.
 * Экспортит domain-service для кросс-домена вниз (материализация задач, цели 2.5).
 */
@Module({
  providers: [
    { provide: ACCENT_HABIT_REPOSITORY, useClass: AccentHabitRepository },
    AccentHabitDomainService,
  ],
  exports: [AccentHabitDomainService],
})
export class HabitsModule {}

import { Module } from '@nestjs/common';
import { ACCENT_HABIT_REPOSITORY } from './adapters/accent-habit-repository.port';
import { AccentHabitRepository } from '../../../database/repositories/accent/accent-habit.repository';

/**
 * Область привычек раздела «Акцент» (мультимодуль, ADR-0050; «сердце продукта», 2.4):
 * порт `ACCENT_HABIT_REPOSITORY` → Drizzle-репо. Domain-service + задачи + лесенка +
 * контроллеры — следующие шаги 2.4·4+. Каркас 2.4·3.
 */
@Module({
  providers: [{ provide: ACCENT_HABIT_REPOSITORY, useClass: AccentHabitRepository }],
})
export class HabitsModule {}

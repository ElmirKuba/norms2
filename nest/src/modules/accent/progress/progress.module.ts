import { Module } from '@nestjs/common';
import { AccentUserAchievementRepository } from '../../../database/repositories/accent/accent-user-achievement.repository';
import { NotificationCoreModule } from '../../notifications/notification-core.module';
import { AccessControlModule } from '../../auth/access-control.module';
import { AntiHabitsModule } from '../anti-habits/anti-habits.module';
import { GoalsModule } from '../goals/goals.module';
import { HabitsModule } from '../habits/habits.module';
import { MicroWinsModule } from '../micro-wins/micro-wins.module';
import { ACCENT_PROGRESS_NOTIFIER } from './adapters/accent-progress-notifier.port';
import { ACCENT_USER_ACHIEVEMENT_REPOSITORY } from './adapters/accent-user-achievement-repository.port';
import { NotificationProgressNotifierAdapter } from './adapters/notification-progress-notifier.adapter';
import { StatsController } from './controllers/stats.controller';
import { AccentAchievementDomainService } from './domain-services/accent-achievement.domain-service';
import { AccentMilestoneNoticeDomainService } from './domain-services/accent-milestone-notice.domain-service';
import { AccentPersistenceDomainService } from './domain-services/accent-persistence.domain-service';
import { GetStatsUseCase } from './use-cases/get-stats.use-case';

/**
 * Прогресс (2.9) — постоянство и достижения. **Читатель, а не участник:** ничего не меняет в
 * трекерах и не получает такого права, иначе кросс-домен пошёл бы вверх и появился круговой DI.
 * Своя таблица ровно одна — `user_achievements`; постоянство считается проекцией из данных
 * соседних областей.
 *
 * `NotificationCoreModule` — ядро центра уведомлений без контроллера и Guard (кросс-фаза вниз,
 * тот же приём, что у `AuthModule`): достижение сообщается спокойной строкой в колокольчик.
 *
 * Замысел целиком — [паспорт фичи](../../../../../docs/sections/accent/gamification-passport.md).
 */
@Module({
  imports: [
    AccessControlModule,
    NotificationCoreModule,
    HabitsModule,
    MicroWinsModule,
    GoalsModule,
    AntiHabitsModule,
  ],
  controllers: [StatsController],
  providers: [
    { provide: ACCENT_USER_ACHIEVEMENT_REPOSITORY, useClass: AccentUserAchievementRepository },
    { provide: ACCENT_PROGRESS_NOTIFIER, useClass: NotificationProgressNotifierAdapter },
    AccentPersistenceDomainService,
    AccentAchievementDomainService,
    AccentMilestoneNoticeDomainService,
    GetStatsUseCase,
  ],
  exports: [
    AccentPersistenceDomainService,
    AccentAchievementDomainService,
    AccentMilestoneNoticeDomainService,
  ],
})
export class ProgressModule {}

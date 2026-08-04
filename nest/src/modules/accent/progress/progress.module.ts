import { Module } from '@nestjs/common';
import { AccentUserAchievementRepository } from '../../../database/repositories/accent/accent-user-achievement.repository';
import { ACCENT_USER_ACHIEVEMENT_REPOSITORY } from './adapters/accent-user-achievement-repository.port';

/**
 * Прогресс (2.9) — постоянство и достижения. **Читатель, а не участник:** ничего не меняет в
 * трекерах и не получает такого права, иначе кросс-домен пошёл бы вверх и появился круговой DI.
 * Своя таблица ровно одна — `user_achievements`; постоянство считается проекцией из данных
 * соседних областей.
 *
 * Состав растёт по шагам подфазы: ·3 движок постоянства, ·4 выдача достижений, ·6 API.
 * Замысел целиком — [паспорт фичи](../../../../../docs/sections/accent/gamification-passport.md).
 */
@Module({
  providers: [
    { provide: ACCENT_USER_ACHIEVEMENT_REPOSITORY, useClass: AccentUserAchievementRepository },
  ],
  exports: [ACCENT_USER_ACHIEVEMENT_REPOSITORY],
})
export class ProgressModule {}

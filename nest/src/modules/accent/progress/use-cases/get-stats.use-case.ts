import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentAntiHabitDomainService } from '../../anti-habits/domain-services/accent-anti-habit.domain-service';
import { AccentGoalDomainService } from '../../goals/domain-services/accent-goal.domain-service';
import { AccentHabitDomainService } from '../../habits/domain-services/accent-habit.domain-service';
import { AccentLadderEngine } from '../../habits/domain-services/accent-ladder-engine.domain-service';
import { AccentTaskDomainService } from '../../habits/domain-services/accent-task.domain-service';
import { AccentMicroWinDomainService } from '../../micro-wins/domain-services/accent-micro-win.domain-service';
import { ACHIEVEMENT_LIST } from '../interfaces/achievement-catalog.const';
import { AccentAchievementDomainService } from '../domain-services/accent-achievement.domain-service';
import { AccentMilestoneNoticeDomainService } from '../domain-services/accent-milestone-notice.domain-service';
import { AccentPersistenceDomainService } from '../domain-services/accent-persistence.domain-service';
import type { AchievementItem, HabitPersistenceItem, StatsView } from '../interfaces/stats-view.interface';
import type { UserAchievementFull } from '../interfaces/user-achievement-full.interface';

/**
 * Use-case экрана статистики (`GET /accent/stats`, 2.9). Точка кросс-домена: зовёт
 * **domain-services** соседних областей (вниз по слоям), как это делает дашборд.
 *
 * Здесь же **лениво догоняются** отложенные вычисления — выдача достижений и вехи «держусь».
 * Крона нет и не нужно: доставка у нас всё равно происходит в момент, когда человек пришёл.
 */
@Injectable()
export class GetStatsUseCase {
  /**
   * @param _tasks Задачи (дни с закрытыми задачами).
   * @param _habits Привычки (постоянство по каждой).
   * @param _ladder Движок лесенки (признак «планка выросла»).
   * @param _microWins Микро-победы.
   * @param _goals Цели.
   * @param _antiHabits «Держусь» (вехи).
   * @param _persistence Движок постоянства.
   * @param _achievements Выдача достижений.
   * @param _milestones Уведомления о вехах.
   */
  public constructor(
    private readonly _tasks: AccentTaskDomainService,
    private readonly _habits: AccentHabitDomainService,
    private readonly _ladder: AccentLadderEngine,
    private readonly _microWins: AccentMicroWinDomainService,
    private readonly _goals: AccentGoalDomainService,
    private readonly _antiHabits: AccentAntiHabitDomainService,
    private readonly _persistence: AccentPersistenceDomainService,
    private readonly _achievements: AccentAchievementDomainService,
    private readonly _milestones: AccentMilestoneNoticeDomainService,
  ) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @returns Снимок экрана статистики.
   */
  public async execute(accountId: string, timezone: string): Promise<StatsView> {
    const today = todayInTimezone(timezone);
    const [taskDays, microWinDays, goalDays, habits, goals] = await Promise.all([
      this._tasks.activeDays(accountId),
      this._microWins.activeDays(accountId),
      this._goals.activeDays(accountId),
      this._habits.list(accountId),
      this._goals.list(accountId, {}),
    ]);

    const persistence = this._persistence.compute([taskDays, microWinDays, goalDays], today);
    // Примеры-витрины пропускаем (ADR-0051): пока не забрал себе — не твоё, и статистики по
    // ним быть не может.
    const ownHabits = habits.filter((habit) => !habit.isStarter);
    const habitDays = await Promise.all(
      ownHabits.map((habit) => this._tasks.activeDays(accountId, habit.id)),
    );

    // Лениво догоняем отложенное: достижения и вехи «держусь».
    await this._achievements.sync(accountId, {
      persistence,
      hasTaskCompletion: taskDays.length > 0,
      taskDays,
      microWinDays,
      hasCompletedGoal: goals.some((goal) => goal.status === 'completed' && !goal.isStarter),
      hasRaisedLadder: ownHabits.some((habit) => this._ladder.wasRaised(habit.ladder)),
    });
    await this._milestones.announce(accountId, await this._antiHabits.syncMilestones(accountId));

    const awarded = await this._achievements.listAwarded(accountId);
    return {
      persistence,
      habits: ownHabits.map<HabitPersistenceItem>((habit, index) => ({
        habitId: habit.id,
        title: habit.title,
        persistence: this._persistence.compute([habitDays[index] ?? []], today),
      })),
      achievements: this._describeAchievements(awarded),
      awardedCount: awarded.length,
    };
  }

  /**
   * Склеивает каталог с выданным: невыданные тоже показываем — с подсказкой «как получить».
   * Скрывать их значило бы превратить достижения в лотерею.
   * @param awarded Выданные достижения аккаунта.
   * @returns Каталог с отметками о выдаче.
   */
  private _describeAchievements(awarded: readonly UserAchievementFull[]): AchievementItem[] {
    const byCode = new Map(awarded.map((item) => [item.code, item]));
    return ACHIEVEMENT_LIST.map((definition) => {
      const got = byCode.get(definition.code);
      return {
        code: definition.code,
        title: definition.title,
        description: definition.description,
        hint: definition.hint,
        awardedAt: got === undefined ? null : got.awardedAt.toISOString(),
        context: got?.context ?? null,
      };
    });
  }
}

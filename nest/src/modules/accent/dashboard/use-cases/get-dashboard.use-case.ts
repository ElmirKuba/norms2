import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentAntiHabitDomainService } from '../../anti-habits/domain-services/accent-anti-habit.domain-service';
import { AccentGoalDomainService } from '../../goals/domain-services/accent-goal.domain-service';
import { AccentHabitDomainService } from '../../habits/domain-services/accent-habit.domain-service';
import { AccentLadderEngine } from '../../habits/domain-services/accent-ladder-engine.domain-service';
import { AccentTaskDomainService } from '../../habits/domain-services/accent-task.domain-service';
import { AccentMicroWinDomainService } from '../../micro-wins/domain-services/accent-micro-win.domain-service';
import { AccentObstacleDomainService } from '../../obstacles/domain-services/accent-obstacle.domain-service';
import { AccentSettingsDomainService } from '../../settings/domain-services/accent-settings.domain-service';
import { AccentNowDomainService } from '../domain-services/accent-now.domain-service';
import { AccentPersistenceDomainService } from '../../progress/domain-services/accent-persistence.domain-service';
import { AccentAchievementDomainService } from '../../progress/domain-services/accent-achievement.domain-service';
import { AccentMilestoneNoticeDomainService } from '../../progress/domain-services/accent-milestone-notice.domain-service';
import { ACHIEVEMENT_CATALOG } from '../../progress/interfaces/achievement-catalog.const';
import type { DashboardView } from '../interfaces/dashboard-view.interface';

/** Сколько задач дня показываем в сводке — дальше человек идёт в «Привычки». */
const TODAY_PREVIEW = 5;
/** Сколько целей показываем — дашборд не заменяет раздел целей. */
const GOALS_PREVIEW = 5;
/** Сколько «держусь» показываем. */
const ANTI_HABITS_PREVIEW = 3;
/** Сколько дней достижение считается свежим и висит строкой на дашборде. */
const FRESH_ACHIEVEMENT_DAYS = 2;

/**
 * Use-case главного экрана (`GET /accent/dashboard`, 2.11): собирает **один согласованный
 * снимок дня** — вместо пяти запросов с фронта, каскада загрузок и мигания блоков.
 *
 * Точка кросс-домена: зовёт **domain-services** соседних областей (вниз по слоям), а не их
 * use-case'ы — круговой DI исключён ([ADR-0030](../../../../../docs/decisions/0030-stack-revision-drizzle-5layer-npm.md)).
 *
 * **Материализует задачи дня** — в отличие от истории привычки. Дашборд и есть вход в день:
 * открыть сегодня — нормальная причина его создать, открыть прошлое — нет.
 */
@Injectable()
export class GetDashboardUseCase {
  /**
   * @param _tasks Задачи дня и просрочка.
   * @param _habits Привычки (для флага онбординга).
   * @param _goals Цели.
   * @param _antiHabits «Держусь».
   * @param _microWins Микро-победы.
   * @param _obstacles Препятствия.
   * @param _settings Настройки раздела (пауза).
   * @param _now Правила выбора «Сейчас».
   */
  public constructor(
    private readonly _tasks: AccentTaskDomainService,
    private readonly _habits: AccentHabitDomainService,
    private readonly _goals: AccentGoalDomainService,
    private readonly _antiHabits: AccentAntiHabitDomainService,
    private readonly _microWins: AccentMicroWinDomainService,
    private readonly _obstacles: AccentObstacleDomainService,
    private readonly _settings: AccentSettingsDomainService,
    private readonly _now: AccentNowDomainService,
    private readonly _persistence: AccentPersistenceDomainService,
    private readonly _ladder: AccentLadderEngine,
    private readonly _achievements: AccentAchievementDomainService,
    private readonly _milestones: AccentMilestoneNoticeDomainService,
  ) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @returns Снимок главного экрана.
   */
  public async execute(accountId: string, timezone: string): Promise<DashboardView> {
    const today = todayInTimezone(timezone);
    const [todayTasks, overdue, habits, goals, antiHabits, microWins, obstacles, settings] =
      await Promise.all([
        this._tasks.listForDay(accountId, today, timezone),
        this._tasks.listOverdue(accountId, today, timezone),
        this._habits.list(accountId),
        this._goals.list(accountId, { status: 'active' }),
        this._antiHabits.list(accountId),
        this._microWins.list(accountId),
        this._obstacles.list(accountId),
        this._settings.getOrCreate(accountId),
      ]);
    const completedMicroWinIds = await this._microWins.completedIdsOn(accountId, today);
    const everMarked = await this._tasks.hasAnyCompletion(accountId);
    // Постоянство (2.9) — считаем здесь же, отдельным заходом за днями активности: на дашборде
    // нужна только пара чисел, а разбор по привычкам живёт на `/accent/stats`.
    const [taskDays, microWinDays, goalDays] = await Promise.all([
      this._tasks.activeDays(accountId),
      this._microWins.activeDays(accountId),
      this._goals.activeDays(accountId),
    ]);
    const persistence = this._persistence.compute([taskDays, microWinDays, goalDays], today);

    // Достижения и вехи догоняем и ЗДЕСЬ, а не только на экране статистики (2.9·14). Иначе
    // человек, который туда не заходит, не получил бы ни одной награды — а дашборд и есть
    // место, где он бывает каждый день.
    await this._achievements.sync(accountId, {
      persistence,
      hasTaskCompletion: taskDays.length > 0,
      taskDays,
      microWinDays,
      hasCompletedGoal: goals.some((goal) => goal.status === 'completed' && !goal.isStarter),
      hasRaisedLadder: habits.some(
        (habit) => !habit.isStarter && this._ladder.wasRaised(habit.ladder),
      ),
    });
    await this._milestones.announce(accountId, await this._antiHabits.syncMilestones(accountId));
    const fresh = await this._achievements.freshest(accountId, FRESH_ACHIEVEMENT_DAYS);

    // Фокусные цели первыми: человек сам сказал, что для него сейчас главное (ADR-0053).
    const topGoals = goals
      .filter((goal) => !goal.isStarter)
      .sort((a, b) => Number(b.focusOrder !== null) - Number(a.focusOrder !== null))
      .slice(0, GOALS_PREVIEW);
    // Процент считаем только для показанных — describe() ходит за записями цели, и делать это
    // для всего списка ради пяти карточек незачем.
    const goalProgress = await Promise.all(
      topGoals.map((goal) => this._goals.describe(goal, timezone)),
    );

    // Пропущенные в проценте дня не участвуют: перенёс — не провалил (2.4·9).
    const counted = todayTasks.filter((task) => task.status !== 'skipped');
    const done = counted.filter((task) => task.status === 'done' || task.status === 'partial');

    return {
      now: this._now.choose(overdue, todayTasks, microWins, completedMicroWinIds),
      today: {
        total: counted.length,
        done: done.length,
        percent: counted.length === 0 ? 0 : Math.round((done.length / counted.length) * 100),
        items: counted.slice(0, TODAY_PREVIEW).map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
        })),
      },
      goals: topGoals.map((goal, index) => ({
        id: goal.id,
        title: goal.title,
        percentage: goalProgress[index]?.percentage ?? null,
        isFocus: goal.focusOrder !== null,
      })),
      antiHabits: antiHabits
        .filter((item) => item.isActive && !item.isStarter)
        .slice(0, ANTI_HABITS_PREVIEW)
        .map((item) => ({
          id: item.id,
          title: item.title,
          currentAttemptStartedAt: item.currentAttemptStartedAt,
        })),
      overdue: overdue.map((task) => ({
        id: task.id,
        title: task.title,
        deadline: (task.deadline ?? new Date()).toISOString(),
      })),
      hasObstacles: obstacles.items.some((obstacle) => !obstacle.isStarter),
      persistence,
      freshAchievement:
        fresh === null
          ? null
          : {
              code: fresh.code,
              title: ACHIEVEMENT_CATALOG[fresh.code].title,
              context: fresh.context,
            },
      onboarding: {
        hasHabits: habits.some((habit) => !habit.isStarter),
        // «Отмечал хоть раз» — по всей истории задач, а не по сегодняшнему дню: иначе человек,
        // отметивший вчера, снова увидел бы шаг «отметь» и решил, что его прогресс не считается.
        hasFirstCompletion: everMarked || completedMicroWinIds.size > 0,
        hasGoals: goals.some((goal) => !goal.isStarter),
      },
      pausedFrom: settings.pausedFrom === null ? null : settings.pausedFrom.toISOString(),
    };
  }
}

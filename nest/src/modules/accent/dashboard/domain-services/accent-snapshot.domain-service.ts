import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentAntiHabitDomainService } from '../../anti-habits/domain-services/accent-anti-habit.domain-service';
import { AccentGoalDomainService } from '../../goals/domain-services/accent-goal.domain-service';
import { AccentHabitDomainService } from '../../habits/domain-services/accent-habit.domain-service';
import { AccentTaskDomainService } from '../../habits/domain-services/accent-task.domain-service';
import { AccentMicroWinDomainService } from '../../micro-wins/domain-services/accent-micro-win.domain-service';
import { AccentPersistenceDomainService } from '../../progress/domain-services/accent-persistence.domain-service';
import { AccentSettingsDomainService } from '../../settings/domain-services/accent-settings.domain-service';
import type { AccentOverviewSnapshot } from '../interfaces/accent-snapshot.interface';

/**
 * Срез «Акцента» для чужих экранов — сейчас для «Обзора» ЛК (2.9·16).
 *
 * **Зачем отдельная точка, а не шесть зависимостей у чужого use-case.** Обзор ЛК не должен
 * знать, что постоянство считается по трём источникам дней, а задачи дня материализуются
 * лениво. Он спрашивает «как идёт Акцент» — раздел отвечает. Появится «Финансы» — они дадут
 * такой же свой срез, и обзор не будет расти зависимостями на каждый новый раздел.
 *
 * Кросс-домен идёт **вниз** ([ADR-0030](../../../../../docs/decisions/0030-stack-revision-drizzle-5layer-npm.md)):
 * use-case ЛК зовёт этот domain-service, а не use-case дашборда.
 */
@Injectable()
export class AccentSnapshotDomainService {
  /**
   * @param _tasks Задачи дня.
   * @param _habits Привычки (есть ли своё).
   * @param _goals Цели.
   * @param _antiHabits «Держусь» (есть ли своё).
   * @param _microWins Микро-победы (дни активности).
   * @param _persistence Постоянство.
   * @param _settings Настройки раздела (пауза).
   */
  public constructor(
    private readonly _tasks: AccentTaskDomainService,
    private readonly _habits: AccentHabitDomainService,
    private readonly _goals: AccentGoalDomainService,
    private readonly _antiHabits: AccentAntiHabitDomainService,
    private readonly _microWins: AccentMicroWinDomainService,
    private readonly _persistence: AccentPersistenceDomainService,
    private readonly _settings: AccentSettingsDomainService,
  ) {}

  /**
   * Собирает срез раздела.
   * @param accountId Владелец.
   * @param timezone IANA-таймзона аккаунта.
   * @returns Срез для обзора ЛК.
   */
  public async build(accountId: string, timezone: string): Promise<AccentOverviewSnapshot> {
    const today = todayInTimezone(timezone);
    // Задачи дня материализуются и здесь: обзор ЛК — тоже вход в день, а без материализации
    // человек, заходящий только на главную, видел бы честный ноль вместо своих задач.
    const [todayTasks, habits, goals, antiHabits, settings] = await Promise.all([
      this._tasks.listForDay(accountId, today, timezone),
      this._habits.list(accountId),
      this._goals.list(accountId),
      this._antiHabits.list(accountId),
      this._settings.getOrCreate(accountId),
    ]);
    const [taskDays, microWinDays, goalDays] = await Promise.all([
      this._tasks.activeDays(accountId),
      this._microWins.activeDays(accountId),
      this._goals.activeDays(accountId),
    ]);
    const persistence = this._persistence.compute([taskDays, microWinDays, goalDays], today);

    // Пропущенные в проценте дня не участвуют: перенёс — не провалил (то же правило, что на
    // дашборде раздела; расхождение чисел между экранами читалось бы как баг).
    const counted = todayTasks.filter((task) => task.status !== 'skipped');
    const done = counted.filter((task) => task.status === 'done' || task.status === 'partial');

    // Одна цель: фокусная, иначе просто первая активная. Обзор показывает «куда я иду», а не
    // весь список — за списком человек идёт в раздел.
    const ownGoals = goals.filter((goal) => !goal.isStarter && goal.status === 'active');
    const goal = ownGoals.find((item) => item.focusOrder !== null) ?? ownGoals[0] ?? null;
    const described = goal === null ? null : await this._goals.describe(goal, timezone);

    return {
      today: {
        done: done.length,
        total: counted.length,
        percent: counted.length === 0 ? 0 : Math.round((done.length / counted.length) * 100),
      },
      persistence: {
        totalDays: persistence.totalDays,
        windowDays: persistence.windowDays,
        windowSize: persistence.windowSize,
      },
      focusGoal:
        goal === null
          ? null
          : { id: goal.id, title: goal.title, percentage: described?.percentage ?? 0 },
      isPaused: settings.pausedFrom !== null,
      hasContent:
        habits.some((habit) => !habit.isStarter) ||
        goals.some((item) => !item.isStarter) ||
        antiHabits.some((item) => !item.isStarter),
    };
  }
}

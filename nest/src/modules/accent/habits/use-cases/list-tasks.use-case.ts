import { Injectable } from '@nestjs/common';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { AccentTaskDomainService } from '../domain-services/accent-task.domain-service';
import { AccentHabitDomainService } from '../domain-services/accent-habit.domain-service';
import { AccentMicroWinDomainService } from '../../micro-wins/domain-services/accent-micro-win.domain-service';
import { toTaskView } from '../interfaces/task-view.interface';
import type { TaskMinAction, TaskView } from '../interfaces/task-view.interface';

/**
 * Use-case задач дня (`GET /accent/tasks?date=YYYY-MM-DD`). Тонкий: domain материализует
 * из привычек + возвращает список; без date — сегодня в TZ аккаунта.
 */
@Injectable()
export class ListTasksUseCase {
  /**
   * @param _tasks Domain-service задач.
   * @param _habits Domain-service привычек (у шаблона лежит ссылка на минимум).
   * @param _microWins Domain-service микро-побед (данные для кнопки и таймера).
   */
  public constructor(
    private readonly _tasks: AccentTaskDomainService,
    private readonly _habits: AccentHabitDomainService,
    private readonly _microWins: AccentMicroWinDomainService,
  ) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @param date Дата `YYYY-MM-DD` (опц.; по умолчанию — сегодня).
   * @returns Проекции задач дня.
   */
  public async execute(accountId: string, timezone: string, date?: string): Promise<TaskView[]> {
    const day = date ?? todayInTimezone(timezone);
    const items = await this._tasks.listForDay(accountId, day, timezone);
    const minActions = await this._minActionsByTemplate(accountId, items);
    return items.map((item) =>
      toTaskView(item, item.templateId === null ? null : (minActions.get(item.templateId) ?? null)),
    );
  }

  /**
   * Собирает «минимум на плохой день» для шаблонов задач дня — двумя запросами на весь список,
   * без N+1: привычки и микро-победы читаются целиком и склеиваются в памяти.
   * @param accountId Идентификатор аккаунта.
   * @param tasks Задачи дня.
   * @returns Карта `templateId → минимум-действие`.
   */
  private async _minActionsByTemplate(
    accountId: string,
    tasks: readonly { templateId: string | null }[],
  ): Promise<Map<string, TaskMinAction>> {
    const templateIds = new Set(
      tasks.flatMap((task) => (task.templateId === null ? [] : [task.templateId])),
    );
    if (templateIds.size === 0) {
      return new Map();
    }
    const habits = (await this._habits.list(accountId)).filter(
      (habit) => templateIds.has(habit.id) && habit.minVersionMicroWinId !== null,
    );
    if (habits.length === 0) {
      return new Map();
    }
    const microWins = new Map((await this._microWins.list(accountId)).map((mw) => [mw.id, mw]));
    const result = new Map<string, TaskMinAction>();
    for (const habit of habits) {
      const microWin = habit.minVersionMicroWinId
        ? microWins.get(habit.minVersionMicroWinId)
        : undefined;
      if (microWin) {
        result.set(habit.id, {
          microWinId: microWin.id,
          title: microWin.title,
          durationSeconds: microWin.durationSeconds,
          prepSeconds: microWin.prepSeconds,
        });
      }
    }
    return result;
  }
}

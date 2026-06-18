import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { TaskNotFoundError } from '../../../../shared/errors/task-not-found.error';
import { localYmd } from '../../../../shared/utility-level/today-in-timezone.util';
import { isHabitDueOn } from '../recurrence.util';
import { ACCENT_TASK_REPOSITORY } from '../adapters/accent-task-repository.port';
import type {
  AccentTaskRepositoryPort,
  TaskCreateData,
} from '../adapters/accent-task-repository.port';
import type { TaskFull } from '../interfaces/task-full.interface';
import { AccentHabitDomainService } from './accent-habit.domain-service';

/**
 * Domain-service задач дня. Ключевая операция — **ленивая материализация**: при чтении дня
 * создаёт Task-снимки из активных привычек, у которых сегодня по RRULE есть вхождение и ещё
 * нет инстанса (идемпотентно — ON CONFLICT по `(template_id, occurred_on)`). Внутри
 * habits-области: использует `AccentHabitDomainService` (список привычек) + порт задач.
 * Выполнение/перенос/разовые — следующие шаги (2.4·9/·10/·11). Фоновый cron-ролловер —
 * отложен (см. интро 2.4, «не потерять»).
 */
@Injectable()
export class AccentTaskDomainService {
  /**
   * @param _repository Порт репозитория задач.
   * @param _habits Domain-service привычек (источник активных шаблонов).
   */
  public constructor(
    @Inject(ACCENT_TASK_REPOSITORY) private readonly _repository: AccentTaskRepositoryPort,
    private readonly _habits: AccentHabitDomainService,
  ) {}

  /**
   * Гарантирует наличие задач дня: материализует снимки из активных due-привычек.
   * Идемпотентно (повторный вызов дублей не создаёт). Якорь RRULE-расписания (для INTERVAL) —
   * локальная дата создания привычки в TZ аккаунта.
   * @param accountId Идентификатор аккаунта.
   * @param date Локальная дата `YYYY-MM-DD`.
   * @param timezone IANA-таймзона аккаунта.
   * @returns Число созданных задач.
   */
  public async ensureTasksForDay(
    accountId: string,
    date: string,
    timezone: string,
  ): Promise<number> {
    const habits = await this._habits.list(accountId);
    const toCreate: TaskCreateData[] = [];
    for (const habit of habits) {
      const dtstart = localYmd(habit.createdAt, timezone);
      if (!isHabitDueOn(habit.recurrence, dtstart, date)) {
        continue;
      }
      toCreate.push({
        accountId,
        templateId: habit.id,
        goalId: habit.goalId,
        title: habit.title,
        occurredOn: date,
        kind: habit.kind,
        targetValue: habit.ladder.currentTarget,
        priority: habit.priority,
        status: 'pending',
      });
    }
    return this._repository.createMany(toCreate);
  }

  /**
   * Задача владельца или 404.
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Задача.
   * @throws {TaskNotFoundError} Если нет / не ваша.
   */
  public async getOwned(id: string, accountId: string): Promise<TaskFull> {
    const found = await this._repository.findOwned(id, accountId);
    if (!found) {
      throw new TaskNotFoundError('Задача не найдена.');
    }
    return found;
  }

  /**
   * Отмечает выполнение задачи (идемпотентно). binary → done=1; quantitative/timed →
   * `doneValue` (или весь target, если не задан). `done` если `doneValue ≥ targetValue`,
   * иначе `partial` (частичное; «победа держит серию при ≥minTarget» — стрик/лесенка ·11/2.9).
   * Лесенка врезается в этот метод на 2.4·11.
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param doneValue Сколько сделано (для quantitative/timed; опц.).
   * @returns Обновлённая задача.
   * @throws {TaskNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если `doneValue` некорректен.
   */
  public async complete(id: string, accountId: string, doneValue?: number): Promise<TaskFull> {
    const task = await this.getOwned(id, accountId);
    let effectiveDone: number;
    if (task.kind === 'binary') {
      effectiveDone = 1;
    } else if (doneValue === undefined) {
      effectiveDone = task.targetValue ?? 1;
    } else {
      if (!Number.isInteger(doneValue) || doneValue < 0) {
        throw new ValidationError('Сделано: целое ≥ 0.');
      }
      effectiveDone = doneValue;
    }
    const target = task.targetValue ?? effectiveDone;
    const updated = await this._repository.update(id, accountId, {
      status: effectiveDone >= target ? 'done' : 'partial',
      doneValue: effectiveDone,
      completedAt: new Date(),
      skipReason: null,
    });
    if (!updated) {
      throw new TaskNotFoundError('Задача не найдена.');
    }
    return updated;
  }

  /**
   * Снимает отметку выполнения (→ pending; doneValue/completedAt/skipReason очищаются).
   * Revoke очков — TODO 2.9.
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая задача.
   * @throws {TaskNotFoundError} Если нет / не ваша.
   */
  public async uncomplete(id: string, accountId: string): Promise<TaskFull> {
    await this.getOwned(id, accountId);
    const updated = await this._repository.update(id, accountId, {
      status: 'pending',
      doneValue: null,
      completedAt: null,
      skipReason: null,
    });
    if (!updated) {
      throw new TaskNotFoundError('Задача не найдена.');
    }
    return updated;
  }
}


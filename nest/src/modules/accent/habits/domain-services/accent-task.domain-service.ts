import { Inject, Injectable } from '@nestjs/common';
import { localYmd } from '../../../../shared/utility-level/today-in-timezone.util';
import { isHabitDueOn } from '../recurrence.util';
import { ACCENT_TASK_REPOSITORY } from '../adapters/accent-task-repository.port';
import type {
  AccentTaskRepositoryPort,
  TaskCreateData,
} from '../adapters/accent-task-repository.port';
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
}

import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { TaskNotFoundError } from '../../../../shared/errors/task-not-found.error';
import { localYmd } from '../../../../shared/utility-level/today-in-timezone.util';
import { isHabitDueOn } from '../recurrence.util';
import { HABIT_KINDS } from '../interfaces/habit-full.interface';
import { ACCENT_TASK_REPOSITORY } from '../adapters/accent-task-repository.port';
import type {
  AccentTaskRepositoryPort,
  TaskCreateData,
} from '../adapters/accent-task-repository.port';
import type { TaskFull } from '../interfaces/task-full.interface';
import { TRANSACTION_RUNNER } from '../../../../shared/transactions/transaction-runner.port';
import type { TransactionRunnerPort } from '../../../../shared/transactions/transaction-runner.port';
import { AccentHabitDomainService } from './accent-habit.domain-service';
import { AccentLadderEngine } from './accent-ladder-engine.domain-service';
import type { LadderEvent } from './accent-ladder-engine.domain-service';

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
    @Inject(TRANSACTION_RUNNER) private readonly _transactionRunner: TransactionRunnerPort,
    private readonly _habits: AccentHabitDomainService,
    private readonly _ladder: AccentLadderEngine,
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
      // Примеры (ADR-0051, ветка Б) — инертная витрина: не материализуем до присвоения.
      if (habit.isStarter) {
        continue;
      }
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
   * Задачи дня: сперва материализует из привычек (идемпотентно), затем возвращает список.
   * @param accountId Идентификатор аккаунта.
   * @param date Локальная дата `YYYY-MM-DD`.
   * @param timezone IANA-таймзона аккаунта.
   * @returns Задачи дня владельца.
   */
  public async listForDay(accountId: string, date: string, timezone: string): Promise<TaskFull[]> {
    await this.ensureTasksForDay(accountId, date, timezone);
    return this._repository.listByAccountOn(accountId, date);
  }

  /**
   * Создаёт разовую задачу (one-off, `templateId=null`) после валидации.
   * @param data Данные создания (без templateId).
   * @returns Созданная задача.
   * @throws {ValidationError} При нарушении инвариантов.
   */
  public async createOneOff(data: TaskCreateData): Promise<TaskFull> {
    const title = data.title.trim();
    if (title.length === 0 || title.length > 120) {
      throw new ValidationError('Название: 1–120 символов.');
    }
    if (!HABIT_KINDS.includes(data.kind)) {
      throw new ValidationError('Недопустимый тип задачи.');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.occurredOn)) {
      throw new ValidationError('Дата: формат YYYY-MM-DD.');
    }
    if (
      data.targetValue !== undefined &&
      data.targetValue !== null &&
      (!Number.isInteger(data.targetValue) || data.targetValue < 1)
    ) {
      throw new ValidationError('Цель: целое ≥ 1.');
    }
    return this._repository.create({ ...data, title, templateId: null, status: 'pending' });
  }

  /**
   * Удаляет ещё не тронутые (`pending`) задачи привычки — при её деактивации (намеренное
   * удаление шаблона убирает и незакрытые дела). `done`/`partial`/`skipped` оставляет (история).
   * @param templateId Идентификатор привычки-шаблона.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Число удалённых.
   */
  public async removePendingForTemplate(templateId: string, accountId: string): Promise<number> {
    return this._repository.deletePendingByTemplate(templateId, accountId);
  }

  /**
   * Просроченные разовые задачи: открытые с дедлайном, чья локальная дата дедлайна < сегодня.
   * @param accountId Идентификатор аккаунта.
   * @param today Сегодня `YYYY-MM-DD` (в TZ аккаунта).
   * @param timezone IANA-таймзона аккаунта.
   * @returns Просроченные задачи.
   */
  public async listOverdue(accountId: string, today: string, timezone: string): Promise<TaskFull[]> {
    const open = await this._repository.listOpenOneOffWithDeadline(accountId);
    return open.filter((t) => t.deadline !== null && localYmd(t.deadline, timezone) < today);
  }

  /**
   * Разовые задачи с дедлайном на сегодня (по TZ аккаунта).
   * @param accountId Идентификатор аккаунта.
   * @param today Сегодня `YYYY-MM-DD`.
   * @param timezone IANA-таймзона аккаунта.
   * @returns Задачи с дедлайном сегодня.
   */
  public async listDueToday(accountId: string, today: string, timezone: string): Promise<TaskFull[]> {
    const open = await this._repository.listOpenOneOffWithDeadline(accountId);
    return open.filter((t) => t.deadline !== null && localYmd(t.deadline, timezone) === today);
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
   * @returns Обновлённая задача + событие лесенки (для фидбэка «планка выросла / мягче»).
   * @throws {TaskNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если `doneValue` некорректен.
   */
  public async complete(
    id: string,
    accountId: string,
    doneValue?: number,
  ): Promise<{ task: TaskFull; ladderEvent: LadderEvent }> {
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
    const patch = {
      status: (effectiveDone >= target ? 'done' : 'partial') as TaskFull['status'],
      doneValue: effectiveDone,
      completedAt: new Date(),
      skipReason: null,
    };
    // Идемпотентность лесенки (ADR-0035): двигаем планку только если ИМЕННО этот вызов
    // перевёл задачу из открытой (pending/skipped) — атомарным условным UPDATE. Параллельный
    // или повторный complete строку не получит → лесенка не двинется дважды.
    const templateId = task.templateId;
    if (templateId !== null) {
      const transitioned = await this._repository.updateIfOpen(id, accountId, patch);
      if (transitioned) {
        const ladderEvent = await this._ladder.onComplete(templateId, accountId, effectiveDone);
        return { task: transitioned, ladderEvent };
      }
    }
    // Разовая задача, либо повторный complete (уже не открыта) — обновляем значение без лесенки.
    const updated = await this._repository.update(id, accountId, patch);
    if (!updated) {
      throw new TaskNotFoundError('Задача не найдена.');
    }
    return { task: updated, ladderEvent: null };
  }

  /**
   * Переносит задачу на завтра: создаёт копию на следующий день (как one-off,
   * `templateId=null` → без конфликта уник `(template_id, occurred_on)`; ссылка
   * `postponedFromTaskId` хранит происхождение), текущую помечает `skipped/postponed`.
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Новая задача на завтра.
   * @throws {TaskNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если задача уже пропущена/перенесена.
   */
  public async postpone(id: string, accountId: string): Promise<TaskFull> {
    const task = await this.getOwned(id, accountId);
    if (task.status === 'skipped') {
      throw new ValidationError('Задача уже пропущена или перенесена.');
    }
    // Атомарно: создать завтрашнюю копию + закрыть исходную (иначе при сбое/повторе —
    // дубль завтрашней задачи или незакрытая исходная).
    return this._transactionRunner.run(async (tx) => {
      const created = await this._repository.create(
        {
          accountId,
          templateId: null,
          goalId: task.goalId,
          title: task.title,
          occurredOn: this._nextDay(task.occurredOn),
          kind: task.kind,
          targetValue: task.targetValue,
          category: task.category,
          deadline: task.deadline,
          priority: task.priority,
          postponedFromTaskId: task.id,
          status: 'pending',
        },
        tx,
      );
      await this._repository.update(
        id,
        accountId,
        { status: 'skipped', skipReason: 'postponed' },
        tx,
      );
      return created;
    });
  }

  /**
   * Следующий день для даты `YYYY-MM-DD` (в «пространстве дат», UTC-полночь +1).
   * @param ymd Дата `YYYY-MM-DD`.
   * @returns Дата следующего дня `YYYY-MM-DD`.
   */
  private _nextDay(ymd: string): string {
    const day = new Date(`${ymd}T00:00:00.000Z`);
    return new Date(day.getTime() + 86_400_000).toISOString().slice(0, 10);
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


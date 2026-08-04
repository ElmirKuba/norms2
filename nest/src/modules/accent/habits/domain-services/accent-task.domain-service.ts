import { Inject, Injectable } from '@nestjs/common';
import { ValidationError } from '../../../../shared/errors/validation.error';
import { TaskNotFoundError } from '../../../../shared/errors/task-not-found.error';
import { TaskValueDowngradeError } from '../../../../shared/errors/task-value-downgrade.error';
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
import { AccentMicroWinDomainService } from '../../micro-wins/domain-services/accent-micro-win.domain-service';
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
    private readonly _microWins: AccentMicroWinDomainService,
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
      // Якорь расписания: пользовательская старт-дата (BUG-2), иначе дата создания в TZ.
      const dtstart = habit.startDate ?? localYmd(habit.createdAt, timezone);
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
   * Дни, в которые была закрыта хотя бы одна задача (2.9) — сырьё для постоянства.
   * **Материализацию не зовёт:** мы запрашиваем историю, а не создаём её.
   * @param accountId Идентификатор аккаунта.
   * @param templateId Опц. привычка-шаблон — тогда дни только этой привычки.
   * @returns Даты `YYYY-MM-DD` по возрастанию.
   */
  public async activeDays(accountId: string, templateId?: string): Promise<string[]> {
    return this._repository.listActiveDays(accountId, templateId);
  }

  /**
   * Отмечал ли человек хоть раз хоть что-то (2.11) — шаг онбординга на дашборде.
   * @param accountId Идентификатор аккаунта.
   * @returns true, если отметки были.
   */
  public async hasAnyCompletion(accountId: string): Promise<boolean> {
    return this._repository.hasAnyCompletion(accountId);
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
   * @param replace Явное намерение перезаписать результат меньшим значением («Начать сначала»).
   * @returns Обновлённая задача + событие лесенки (для фидбэка «планка выросла / мягче»).
   * @throws {TaskNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если `doneValue` некорректен.
   * @throws {TaskValueDowngradeError} Понижение уже записанного результата без `replace` (2.7.1).
   */
  public async complete(
    id: string,
    accountId: string,
    doneValue?: number,
    replace = false,
  ): Promise<{ task: TaskFull; ladderEvent: LadderEvent; transitioned: boolean }> {
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
    // Успех зависит от полярности (FEAT-H2): `clock` = «ниже/раньше лучше» (уложился = `≤`),
    // остальные — «выше лучше» (`≥`). (kind='clock' ⟹ лесенка lower, см. форма привычки.)
    const met = task.kind === 'clock' ? effectiveDone <= target : effectiveDone >= target;
    // Защита от тихого понижения (2.7.1): вкладка с устаревшими данными присылала меньшее
    // значение и молча затирала результат («100 приседаний» → «60»). Легальное понижение ровно
    // одно — «Начать сначала» в таймере, и оно приходит с `replace`. Для `clock` направление
    // обратное (раньше = лучше), поэтому там «понижением» считается рост значения.
    if (!replace && task.doneValue !== null) {
      const worse =
        task.kind === 'clock' ? effectiveDone > task.doneValue : effectiveDone < task.doneValue;
      if (worse) {
        // Текст без «обновите страницу»: экран обновит себя сам (2.7.1·F5), человеку остаётся
        // только понять, что произошло.
        throw new TaskValueDowngradeError('Эта задача уже отмечена с лучшим результатом.');
      }
    }
    const patch = {
      status: (met ? 'done' : 'partial') as TaskFull['status'],
      doneValue: effectiveDone,
      completedAt: new Date(),
      skipReason: null,
    };
    // Идемпотентность лесенки (ADR-0035): двигаем планку только если ИМЕННО этот вызов
    // перевёл задачу из открытой (pending/skipped) — атомарным условным UPDATE. Параллельный
    // или повторный complete строку не получит → лесенка не двинется дважды.
    const templateId = task.templateId;
    if (templateId !== null) {
      const transitionedRow = await this._repository.updateIfOpen(id, accountId, patch);
      if (transitionedRow) {
        const { event: ladderEvent, before } = await this._ladder.onComplete(
          templateId,
          accountId,
          effectiveDone,
        );
        // Снимок «как было до» кладём на строку задачи (2.7.3): без него отмена отметки не сможет
        // вернуть планку — лесенка накопитель, прежнего состояния нигде больше нет.
        const withSnapshot =
          before === null
            ? transitionedRow
            : ((await this._repository.update(id, accountId, { ladderBefore: before })) ??
              transitionedRow);
        return { task: withSnapshot, ladderEvent, transitioned: true };
      }
    }
    // Разовая задача, либо повторный complete (уже не открыта) — обновляем значение без лесенки.
    // `transitioned` для разовой = была ли задача открыта до вызова (для кросс-домена 2.5·13,
    // один раз на переход); для повтора привычки-задачи — false (строку выше не получили).
    const wasOpen = task.status === 'pending' || task.status === 'skipped';
    const updated = await this._repository.update(id, accountId, patch);
    if (!updated) {
      throw new TaskNotFoundError('Задача не найдена.');
    }
    return { task: updated, ladderEvent: null, transitioned: templateId === null && wasOpen };
  }

  /**
   * Переносит задачу на завтра: создаёт копию на следующий день (**наследует `templateId`** —
   * чтобы занять слот уник `(template_id, occurred_on)`; ссылка `postponedFromTaskId` хранит
   * происхождение для метки «со вчера»), текущую помечает `skipped/postponed`.
   *
   * **Почему наследуем `templateId` (фикс дубля, BUG-5):** раньше копия шла `templateId=null`
   * («чтобы не конфликтовать»), но тогда она НЕ занимала слот привычки на завтра — и материализация
   * дня (`ensureTasksForDay`, `createMany` c `onConflictDoNothing`) создавала ВТОРОЙ инстанс той же
   * ежедневной/через-день привычки → задача двоилась. Наследуя `templateId`, перенос занимает слот,
   * и материализация его пропускает. Разовые (`templateId=null`) остаются one-off, как были.
   *
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Задача на завтра (новая или уже существовавший инстанс этой привычки на завтра).
   * @throws {TaskNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если задача уже пропущена/перенесена.
   */
  public async postpone(id: string, accountId: string): Promise<TaskFull> {
    const task = await this.getOwned(id, accountId);
    if (task.status === 'skipped') {
      throw new ValidationError('Задача уже пропущена или перенесена.');
    }
    const nextDay = this._nextDay(task.occurredOn);
    // Для привычки (templateId != null): если завтра УЖЕ есть её инстанс (материализованный или
    // ранее перенесённый) — не плодим дубль и не ловим конфликт уника: закрываем исходную и
    // возвращаем существующий. (Разовые задачи слота не имеют — идут обычным путём ниже.)
    if (task.templateId !== null) {
      const existing = (await this._repository.listByAccountOn(accountId, nextDay)).find(
        (t) => t.templateId === task.templateId && t.id !== task.id,
      );
      if (existing !== undefined) {
        await this._repository.update(id, accountId, { status: 'skipped', skipReason: 'postponed' });
        return existing;
      }
    }
    // Атомарно: создать завтрашнюю копию + закрыть исходную (иначе при сбое/повторе —
    // дубль завтрашней задачи или незакрытая исходная).
    return this._transactionRunner.run(async (tx) => {
      const created = await this._repository.create(
        {
          accountId,
          templateId: task.templateId,
          goalId: task.goalId,
          title: task.title,
          occurredOn: nextDay,
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
   * Возвращает перенесённую задачу обратно на сегодня (2.7.2). Зеркало `postpone`: сегодняшняя
   * строка снова `pending`, а завтрашняя копия, рождённая этим переносом, удаляется.
   *
   * **Зачем:** перенос был единственным необратимым действием раздела — и делается он в худшем
   * состоянии человека. Отметку выполнения отменить можно, а «сегодня не могу» — нельзя; продукт,
   * обещающий «плохой день не отменяет прогресс», не должен фиксировать плохой день окончательно.
   *
   * Границы: только `skipped/postponed` и только **сегодняшняя** задача — воскрешать позавчерашние
   * переносы значило бы переписывать историю, а не «дух восстановился». Завтрашнюю копию удаляем
   * лишь если её никто не трогал (`pending`, без значения) и она родилась именно из этого переноса;
   * тронутую оставляем — там уже чужой результат. Лесенка не двигается: перенос её не двигал.
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param today Сегодняшний день аккаунта (`YYYY-MM-DD`, по его таймзоне).
   * @returns Задача, вернувшаяся в работу.
   * @throws {TaskNotFoundError} Если нет / не ваша.
   * @throws {ValidationError} Если задача не переносилась или относится к другому дню.
   */
  public async unpostpone(id: string, accountId: string, today: string): Promise<TaskFull> {
    const task = await this.getOwned(id, accountId);
    if (task.status !== 'skipped' || task.skipReason !== 'postponed') {
      throw new ValidationError('Эта задача не переносилась.');
    }
    if (task.occurredOn !== today) {
      throw new ValidationError('Вернуть можно только сегодняшний перенос.');
    }
    const nextDay = this._nextDay(task.occurredOn);
    const copy = (await this._repository.listByAccountOn(accountId, nextDay)).find(
      (t) => t.postponedFromTaskId === task.id,
    );
    const copyUntouched =
      copy !== undefined && copy.status === 'pending' && copy.doneValue === null;
    return this._transactionRunner.run(async (tx) => {
      if (copy !== undefined && copyUntouched) {
        await this._repository.deleteOwned(copy.id, accountId, tx);
      }
      const restored = await this._repository.update(
        id,
        accountId,
        { status: 'pending', skipReason: null, completedAt: null, doneValue: null },
        tx,
      );
      if (restored === null) {
        throw new TaskNotFoundError('Задача не найдена.');
      }
      return restored;
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
   * **«Минимум на плохой день»** (2.7·H): человек не тянет полную программу, но делает
   * привязанную к привычке микро-победу. Одним действием: пишем лог микро-победы **и** закрываем
   * задачу как `partial` со значением `ladder.minTarget`.
   *
   * Почему именно так:
   * - **`partial`, а не `done`** — честно: полная планка не взята. Но `≥ minTarget` держит серию,
   *   ради чего всё и затевается: плохой день не рвёт цепочку.
   * - **лесенку не двигаем** — ни вверх, ни вниз. Минимум это не успех и не провал, а «удержался»;
   *   двигать планку по нему значило бы наказывать за честность или награждать за поблажку.
   * - **идемпотентно** — закрываем только открытую задачу (`updateIfOpen`); повторный вызов
   *   вернёт текущее состояние и не запишет второй лог.
   *
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param occurredOn Локальная дата `YYYY-MM-DD` (для лога микро-победы).
   * @returns Обновлённая задача + была ли микро-победа отмечена впервые за день.
   * @throws {TaskNotFoundError} Если задачи нет / не ваша.
   * @throws {ValidationError} Если у привычки нет привязанного минимума.
   */
  public async completeMinimum(
    id: string,
    accountId: string,
    occurredOn: string,
  ): Promise<{ task: TaskFull; microWinNewlyCompleted: boolean }> {
    const task = await this.getOwned(id, accountId);
    if (task.templateId === null) {
      throw new ValidationError('У разовой задачи нет минимума — он берётся из привычки.');
    }
    const habit = await this._habits.getOwned(task.templateId, accountId);
    const microWinId = habit.minVersionMicroWinId;
    if (microWinId === null) {
      throw new ValidationError('У привычки не задан минимум на плохой день.');
    }
    const minTarget = habit.ladder.minTarget;

    return this._transactionRunner.run(async () => {
      const { newlyCompleted } = await this._microWins.complete(microWinId, accountId, occurredOn);
      const patch = {
        status: 'partial' as TaskFull['status'],
        doneValue: minTarget,
        completedAt: new Date(),
        skipReason: null,
      };
      // Только открытую: повтор не перезапишет уже зачтённый результат (в т.ч. полный `done`).
      const updated = await this._repository.updateIfOpen(id, accountId, patch);
      return { task: updated ?? task, microWinNewlyCompleted: newlyCompleted };
    });
  }

  /**
   * Снимает отметку выполнения (→ pending; doneValue/completedAt/skipReason очищаются).
   * Revoke очков — TODO 2.9.
   * @param id Идентификатор задачи.
   * @param accountId Идентификатор аккаунта-владельца.
   * @returns Обновлённая задача.
   * @throws {TaskNotFoundError} Если нет / не ваша.
   */
  public async uncomplete(id: string, accountId: string, today: string): Promise<TaskFull> {
    const task = await this.getOwned(id, accountId);
    // Граница «только сегодня» (2.7.3, реш. Elmir): отменить можно ровно то, что видно в
    // «Сегодня». Вчерашнее не отменяем принципиально — ответственность за прошлое остаётся у
    // человека, продукт не делает вид, что умеет его переписывать. Технически граница снимает
    // и главную засаду отката: возврат НЕ последней отметки стёр бы все последующие движения
    // планки.
    if (task.occurredOn !== today) {
      throw new ValidationError('Отменить можно только сегодняшнюю отметку.');
    }
    const updated = await this._repository.update(id, accountId, {
      status: 'pending',
      doneValue: null,
      completedAt: null,
      skipReason: null,
      ladderBefore: null,
    });
    if (!updated) {
      throw new TaskNotFoundError('Задача не найдена.');
    }
    // Возврат планки (2.7.3): отменил отметку — значит её не было. Снимок снят при complete;
    // нет снимка (минимум, ручная лесенка, разовая задача) — возвращать нечего, и это норма.
    if (task.templateId !== null && task.ladderBefore !== null) {
      await this._ladder.revert(task.templateId, accountId, task.ladderBefore);
    }
    return updated;
  }
}


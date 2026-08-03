import { Inject, Injectable } from '@nestjs/common';
import {
  ACCENT_HABIT_REPOSITORY,
  type AccentHabitRepositoryPort,
} from '../adapters/accent-habit-repository.port';
import {
  ACCENT_TASK_REPOSITORY,
  type AccentTaskRepositoryPort,
} from '../adapters/accent-task-repository.port';
import { HabitNotFoundError } from '../../../../shared/errors/habit-not-found.error';
import type { TaskFull } from '../interfaces/task-full.interface';
import type {
  HabitHistoryDay,
  HabitHistoryEvent,
  HabitHistoryView,
  HabitLadderMove,
} from '../interfaces/habit-history-view.interface';

/** Размер страницы по умолчанию. */
const DEFAULT_LIMIT = 30;
/** Максимум за раз — чтобы «Показать ещё» не превращалось в выгрузку всей жизни. */
const MAX_LIMIT = 90;
/** Сколько суток между двумя `YYYY-MM-DD`. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Сдвигает дату `YYYY-MM-DD` на `days` суток. */
function shiftDay(ymd: string, days: number): string {
  const base = Date.parse(`${ymd}T00:00:00.000Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * История одной привычки для экрана «что было с этой привычкой» (2.7.3).
 *
 * **Только чтение.** В отличие от `listForDay`, здесь **не вызывается материализация**: просмотр
 * истории не должен рождать задачи за прошлые дни — тем более со снимком **сегодняшней** планки
 * вместо тогдашней. «Запрашиваем историю, а не создаём её» (реш. Elmir 2026-08-01).
 *
 * Отдаёт **обработанные факты**, а не сырьё: перенос склеен в одно событие, движение планки
 * восстановлено, «тишина» посчитана. Разбирать статусы на фронте — не его работа.
 */
@Injectable()
export class AccentHabitHistoryDomainService {
  /**
   * @param _tasks Порт репозитория задач.
   * @param _habits Порт репозитория привычек.
   */
  public constructor(
    @Inject(ACCENT_TASK_REPOSITORY) private readonly _tasks: AccentTaskRepositoryPort,
    @Inject(ACCENT_HABIT_REPOSITORY) private readonly _habits: AccentHabitRepositoryPort,
  ) {}

  /**
   * Собирает страницу истории привычки.
   * @param habitId Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param today Сегодняшний день аккаунта (`YYYY-MM-DD`, по его таймзоне).
   * @param timezone IANA-таймзона аккаунта (для якоря расписания).
   * @param options `before` — курсор «Показать ещё», `limit` — размер страницы.
   * @returns Страница дней + «тишина».
   * @throws {HabitNotFoundError} Если привычки нет / она не ваша.
   */
  public async page(
    habitId: string,
    accountId: string,
    today: string,
    timezone: string,
    options: { before?: string; limit?: number } = {},
  ): Promise<HabitHistoryView> {
    const habit = await this._habits.findOwned(habitId, accountId);
    if (habit === null) {
      throw new HabitNotFoundError('Привычка не найдена.');
    }
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    // Берём на одну строку больше — она нужна ТОЛЬКО чтобы понять, двигалась ли планка на
    // границе страницы (сравнение идёт с предыдущим по времени днём). Наружу не отдаём.
    // `exactOptionalPropertyTypes`: ключ не передаём вовсе, а не передаём undefined.
    const rows = await this._tasks.listByTemplate(habitId, accountId, {
      ...(options.before === undefined ? {} : { before: options.before }),
      limit: limit + 1,
    });
    // Будущее в «историю» не пускаем: завтрашняя копия переноса или заранее материализованный
    // день — это ещё не то, что было. Отсекаем здесь, а не в SQL: страница уже прочитана, а
    // будущих дней у привычки максимум один-два.
    const past = rows.filter((task) => task.occurredOn <= today);
    const page = past.slice(0, limit);
    const olderNeighbour = past[limit] ?? null;

    const items = page.map((task, index) =>
      this._toDay(task, page[index + 1] ?? olderNeighbour, today),
    );
    const lastMarkedOn = await this._tasks.findLastMarkedOn(habitId, accountId);

    return {
      items,
      nextCursor: past.length > limit ? (page[page.length - 1]?.occurredOn ?? null) : null,
      lastMarkedOn,
      daysSinceLastMark: lastMarkedOn === null ? null : daysBetween(lastMarkedOn, today),
    };
  }

  /**
   * Превращает строку задачи в день истории. Перенос отдаётся **одним** событием с датой
   * назначения: `postpone` всегда двигает ровно на следующий день, поэтому искать копию не нужно
   * (а её могло и не быть — если инстанс на завтра уже существовал).
   * @param task Задача этого дня.
   * @param older Предыдущий по времени день (для сравнения планки) или null.
   * @param today Сегодняшний день аккаунта.
   * @returns День истории.
   */
  private _toDay(task: TaskFull, older: TaskFull | null, today: string): HabitHistoryDay {
    return {
      occurredOn: task.occurredOn,
      event: this._event(task),
      doneValue: task.doneValue,
      targetValue: task.targetValue,
      completedAt: task.completedAt === null ? null : task.completedAt.toISOString(),
      postponedTo:
        task.status === 'skipped' && task.skipReason === 'postponed'
          ? shiftDay(task.occurredOn, 1)
          : null,
      isToday: task.occurredOn === today,
      ladderMove: this._ladderMove(task, older),
    };
  }

  /**
   * Событие дня. `skipped` бывает только «перенесено» — других причин пропуска в системе нет
   * (см. `TASK_SKIP_REASONS`).
   * @param task Задача.
   * @returns Событие дня.
   */
  private _event(task: TaskFull): HabitHistoryEvent {
    switch (task.status) {
      case 'done':
        return 'done';
      case 'partial':
        return 'partial';
      case 'skipped':
        return 'postponed';
      default:
        return 'pending';
    }
  }

  /**
   * Движение планки: `targetValue` — снимок `ladder.currentTarget` на день, поэтому разница со
   * вчерашним снимком и есть факт «планка выросла/стала мягче». Механику («ещё один успех — и
   * поднимется») наружу не отдаём осознанно: это приглашение играть с планкой (D, ADR-0049).
   * @param task Задача дня.
   * @param older Предыдущий по времени день или null.
   * @returns Движение или null.
   */
  private _ladderMove(task: TaskFull, older: TaskFull | null): HabitLadderMove | null {
    if (older === null || task.targetValue === null || older.targetValue === null) {
      return null;
    }
    return task.targetValue === older.targetValue
      ? null
      : { from: older.targetValue, to: task.targetValue };
  }

}

import { Inject, Injectable } from '@nestjs/common';
import { ACCENT_TASK_REPOSITORY } from '../adapters/accent-task-repository.port';
import type { AccentTaskRepositoryPort } from '../adapters/accent-task-repository.port';
import { todayInTimezone } from '../../../../shared/utility-level/today-in-timezone.util';
import { ValidationError } from '../../../../shared/errors/validation.error';

/** Что календарь знает про день. */
export interface DayMapEntry {
  /** День `YYYY-MM-DD`. */
  date: string;
  /** В этот день что-то было — значит в него можно зайти. */
  hasContent: boolean;
}

/**
 * Use-case карты дней (`GET /accent/days`, 2.10·B2).
 *
 * Календарь пускает **только в дни, где что-то было** (реш. Elmir 15.08.2026), поэтому фронту
 * нужен список кликабельных дат заранее: рисовать месяц, спрашивая сервер о каждой клетке, — это
 * тридцать запросов на один экран.
 *
 * Будущее в карту не попадает вовсе: туда нельзя ни зайти, ни что-то записать.
 */
@Injectable()
export class ListDayMapUseCase {
  /**
   * @param _tasks Порт хранилища задач.
   */
  public constructor(
    @Inject(ACCENT_TASK_REPOSITORY) private readonly _tasks: AccentTaskRepositoryPort,
  ) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @param timezone IANA-таймзона аккаунта (из Guard).
   * @param from Начало периода `YYYY-MM-DD`.
   * @param to Конец периода `YYYY-MM-DD`.
   * @returns Дни периода, в которые есть содержимое.
   * @throws {ValidationError} Неверный формат или период больше года.
   */
  public async execute(
    accountId: string,
    timezone: string,
    from: string,
    to: string,
  ): Promise<DayMapEntry[]> {
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!pattern.test(from) || !pattern.test(to)) {
      throw new ValidationError('Даты периода: формат YYYY-MM-DD.');
    }
    if (from > to) {
      throw new ValidationError('Начало периода позже конца.');
    }
    // Предел, чтобы один запрос не тянул всю историю: календарь показывает месяцы, а не годы.
    const span = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    if (span > 366) {
      throw new ValidationError('Период больше года запрашивать нельзя.');
    }

    // Будущее обрезаем здесь, а не на фронте: в него всё равно нельзя зайти.
    const today = todayInTimezone(timezone);
    const rightBound = to > today ? today : to;
    if (from > rightBound) {
      return [];
    }

    const days = await this._tasks.daysWithTasks(accountId, from, rightBound);
    return days.map((date) => ({ date, hasContent: true }));
  }
}

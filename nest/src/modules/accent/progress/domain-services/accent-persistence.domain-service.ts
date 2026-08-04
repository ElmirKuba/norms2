import { Injectable } from '@nestjs/common';
import type { PersistenceView } from '../interfaces/persistence.interface';

/** Размер окна «как я сейчас» в днях. Неделя — привычная человеку единица ритма. */
export const PERSISTENCE_WINDOW_DAYS = 7;

/**
 * Сколько дней тишины считается «долгим перерывом» (правило достижения «Вернулся» и счётчик
 * возвращений). Неделя молчания — это уже выпадение из ритма, а не «пропустил денёк».
 */
export const RETURN_SILENCE_DAYS = 7;

/** Миллисекунд в сутках — для разницы между календарными датами. */
const MS_PER_DAY = 86_400_000;

/**
 * Движок постоянства (2.9) — **чистая функция над готовыми датами**, как `AccentNowDomainService`
 * у дашборда: ничего не запрашивает сам, всё приходит из use-case. Поэтому его поведение
 * проверяемо целиком, без БД.
 *
 * Работает **проекцией**: дни с действием приходят из `tasks`/`micro_win_logs`/`goal_entries`,
 * своей таблицы у постоянства нет. Отменил отметку — её вклад исчез сам, компенсирующие записи
 * не нужны и рассинхрон невозможен.
 *
 * **День засчитан = любое зафиксированное действие.** Порога «≥70% задач дня» из черновика нет:
 * он вернул бы «всё или ничего» через заднюю дверь и обесценил день, в который человек сделал
 * два дела из четырёх.
 */
@Injectable()
export class AccentPersistenceDomainService {
  /**
   * Считает постоянство по дням активности из нескольких источников.
   * @param sources Наборы дат `YYYY-MM-DD` из разных источников (пересечения нормальны).
   * @param today Сегодня `YYYY-MM-DD` в TZ аккаунта.
   * @returns Пара чисел + факты вокруг них.
   */
  public compute(sources: readonly (readonly string[])[], today: string): PersistenceView {
    // Объединение, а не сумма: один и тот же день мог быть отмечен и задачей, и микро-победой.
    // Будущее отсекаем — задача с датой вперёд не делает сегодняшний день прожитым.
    const days = [...new Set(sources.flat())].filter((day) => day <= today).sort();
    const lastActiveOn = days[days.length - 1] ?? null;
    const windowStart = this._shiftDays(today, -(PERSISTENCE_WINDOW_DAYS - 1));

    return {
      totalDays: days.length,
      windowDays: days.filter((day) => day >= windowStart).length,
      windowSize: PERSISTENCE_WINDOW_DAYS,
      lastActiveOn,
      returnCount: this._countReturns(days),
      silenceDays: lastActiveOn === null ? 0 : this._diffDays(today, lastActiveOn),
    };
  }

  /**
   * Сколько раз между соседними активными днями лежал перерыв длиной `RETURN_SILENCE_DAYS` и
   * больше. Считается по **уже прожитым** дням: текущая тишина, ещё не прерванная, возвращением
   * не является — возвращение случается в момент, когда человек снова отметил.
   * @param days Отсортированные различные даты.
   * @returns Число возвращений.
   */
  private _countReturns(days: readonly string[]): number {
    let returns = 0;
    for (let i = 1; i < days.length; i += 1) {
      const previous = days[i - 1];
      const current = days[i];
      if (previous === undefined || current === undefined) {
        continue;
      }
      // Пустых дней между отметками: разница минус сам переход.
      if (this._diffDays(current, previous) - 1 >= RETURN_SILENCE_DAYS) {
        returns += 1;
      }
    }
    return returns;
  }

  /**
   * Разница в календарных днях между двумя `YYYY-MM-DD`. Считаем в UTC-полночь: обе даты уже
   * приведены к TZ аккаунта выше по стеку, и переводить их обратно во время — значит поймать
   * перевод часов там, где его нет.
   * @param later Более поздняя дата.
   * @param earlier Более ранняя дата.
   * @returns Число дней между ними.
   */
  private _diffDays(later: string, earlier: string): number {
    return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / MS_PER_DAY);
  }

  /**
   * Сдвигает дату на `delta` дней.
   * @param day Дата `YYYY-MM-DD`.
   * @param delta Сдвиг в днях (может быть отрицательным).
   * @returns Дата `YYYY-MM-DD`.
   */
  private _shiftDays(day: string, delta: number): string {
    const shifted = new Date(Date.parse(`${day}T00:00:00Z`) + delta * MS_PER_DAY);
    return shifted.toISOString().slice(0, 10);
  }
}

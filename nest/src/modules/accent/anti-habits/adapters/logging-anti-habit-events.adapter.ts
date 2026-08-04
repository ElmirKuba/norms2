import { Injectable, Logger } from '@nestjs/common';
import type {
  AccentAntiHabitEventsPort,
  AntiHabitHeldEvent,
  AntiHabitRelapsedEvent,
} from './accent-anti-habit-events.port';

/**
 * Логирующая реализация порта событий (2.6): пишет debug-лог, слушателей нет.
 *
 * **2.9 её не заменила — и это осознанно (04.08.2026).** Ожидалось, что геймификация подпишется
 * сюда и начислит очки; но очков в среднем варианте нет, а факты вычисляются из данных: вехи
 * «держусь» лежат в журнале таймлайна (`goal_reached`, ADR-0060) и догоняются лениво через
 * `syncMilestones()`, срывы видны там же. Подписка нужна тому, кто **обязан среагировать в
 * момент** события; читателю достаточно посмотреть.
 *
 * Порт оставляем: он даёт домену чистую границу, и если часть 2 (очки) когда-нибудь выйдет,
 * подменить реализацию можно будет без касания домена — ровно ради этого он и заводился.
 */
@Injectable()
export class LoggingAntiHabitEventsAdapter implements AccentAntiHabitEventsPort {
  /** Логгер области. */
  private readonly _logger = new Logger('AntiHabitEvents');

  /**
   * @param event Данные срыва.
   */
  public relapsed(event: AntiHabitRelapsedEvent): void {
    this._logger.debug(
      `anti_habit.relapsed anti=${event.antiHabitId} attempt#${event.endedAttemptNumber} durMs=${event.endedAttemptDurationMs}`,
    );
  }

  /**
   * @param event Данные вехи.
   */
  public held(event: AntiHabitHeldEvent): void {
    this._logger.debug(`anti_habit.held anti=${event.antiHabitId} days=${event.days}`);
  }
}

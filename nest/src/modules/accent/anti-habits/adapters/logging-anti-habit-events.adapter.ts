import { Injectable, Logger } from '@nestjs/common';
import type {
  AccentAntiHabitEventsPort,
  AntiHabitHeldEvent,
  AntiHabitRelapsedEvent,
} from './accent-anti-habit-events.port';

/**
 * Логирующая реализация порта событий (2.6): просто пишет debug-лог — слушателей нет до
 * 2.9. Это инфра-адаптер (конкретика), биндится в composition root (anti-habits.module).
 * В 2.9 заменится на реальную event-шину/начисление очков без касания домена.
 */
@Injectable()
export class LoggingAntiHabitEventsAdapter implements AccentAntiHabitEventsPort {
  /** Логгер области. */
  private readonly _logger = new Logger('AntiHabitEvents');

  /**
   * @param event Данные срыва.
   */
  public relapsed(event: AntiHabitRelapsedEvent): void {
    // TODO: Claude Code: 2026-07-23: 2.9 — подписать геймификацию на anti_habit.relapsed (очки/ачивки).
    this._logger.debug(
      `anti_habit.relapsed anti=${event.antiHabitId} attempt#${event.endedAttemptNumber} durMs=${event.endedAttemptDurationMs}`,
    );
  }

  /**
   * @param event Данные вехи.
   */
  public held(event: AntiHabitHeldEvent): void {
    // TODO: Claude Code: 2026-07-23: 2.9 — дневной чек-ин серий эмитит anti_habit.held (вехи 3/7/14/30…).
    this._logger.debug(`anti_habit.held anti=${event.antiHabitId} days=${event.days}`);
  }
}

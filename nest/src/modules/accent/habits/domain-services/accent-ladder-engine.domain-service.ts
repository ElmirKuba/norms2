import { Injectable } from '@nestjs/common';
import { AccentHabitDomainService } from './accent-habit.domain-service';
import type { HabitLadder } from '../interfaces/habit-full.interface';

/** Порог «лёгких» выполнений подряд для подъёма планки (gamification §7, дефолт 3). */
const EASE_THRESHOLD = 3;
/** Порог недоборов подряд для мягкого отката. */
const MISS_THRESHOLD = 2;

/** Результат подстройки лесенки. */
export type LadderEvent = 'raised' | 'lowered' | null;

/**
 * `LadderEngine` — ядро адаптивности (алгоритм gamification §7). На выполнение
 * adaptive-привычки двигает `currentTarget`: серия лёгких → подъём (`+step` ≤ goalTarget),
 * недоборы подряд → мягкий откат (к minTarget). `manual` не трогает. Recovery-ветка (по
 * `UserState`) — в 2.4 НЕ включена (доберём в 2.8). Очки за `raised` — TODO 2.9.
 */
@Injectable()
export class AccentLadderEngine {
  /**
   * @param _habits Domain-service привычек (читает/пишет лесенку).
   */
  public constructor(private readonly _habits: AccentHabitDomainService) {}

  /**
   * Подстраивает лесенку привычки после выполнения её задачи за день.
   * @param habitId Идентификатор привычки.
   * @param accountId Идентификатор аккаунта-владельца.
   * @param performed Сколько сделано (binary: 1 при done).
   * @returns Событие подъёма/отката или null (нет изменения / manual / привычка не найдена).
   */
  public async onComplete(
    habitId: string,
    accountId: string,
    performed: number,
  ): Promise<LadderEvent> {
    const habit = await this._habits.findOwnedOrNull(habitId, accountId);
    if (!habit || habit.ladder.policy !== 'adaptive') {
      return null;
    }
    const { ladder, event } = this._apply(habit.ladder, performed);
    await this._habits.setLadder(habitId, accountId, ladder);
    // TODO: Claude Code: 2026-06-18: 2.9 — при event эмитить ladder.raised/lowered (очки/тосты).
    return event;
  }

  /**
   * Чистая подстройка лесенки (без побочных эффектов; алгоритм §7).
   * @param ladder Текущая лесенка.
   * @param performed Сколько сделано.
   * @returns Новая лесенка + событие.
   */
  private _apply(ladder: HabitLadder, performed: number): { ladder: HabitLadder; event: LadderEvent } {
    const step = ladder.step ?? 1;
    let { currentTarget, easyStreak, missStreak } = ladder;
    let event: LadderEvent = null;

    if (performed >= currentTarget) {
      // Выполнил норму: копим «лёгкие», при пороге — поднимаем планку.
      missStreak = 0;
      easyStreak += 1;
      const underCap = ladder.goalTarget === null || currentTarget < ladder.goalTarget;
      if (easyStreak >= EASE_THRESHOLD && underCap) {
        const raised = currentTarget + step;
        currentTarget = ladder.goalTarget === null ? raised : Math.min(raised, ladder.goalTarget);
        easyStreak = 0;
        event = 'raised';
      }
    } else if (performed >= ladder.minTarget) {
      // Минимальная победа: серия цела, планку не растим.
      easyStreak = 0;
      missStreak = 0;
    } else {
      // Недобор/срыв: при двух подряд — мягкий откат к minTarget.
      easyStreak = 0;
      missStreak += 1;
      if (missStreak >= MISS_THRESHOLD) {
        currentTarget = Math.max(ladder.minTarget, currentTarget - step);
        missStreak = 0;
        event = 'lowered';
      }
    }

    return { ladder: { ...ladder, currentTarget, easyStreak, missStreak }, event };
  }
}

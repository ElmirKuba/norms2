import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccentHabitDomainService } from './accent-habit.domain-service';
import type { HabitLadder } from '../interfaces/habit-full.interface';
import type { Env } from '../../../../system/config/env.schema';

/** Порог «лёгких» выполнений подряд для подъёма планки (gamification §7, дефолт 3). */
const EASE_THRESHOLD = 3;
/** Порог недоборов подряд для мягкого отката. */
const MISS_THRESHOLD = 2;

/**
 * Результат подстройки лесенки: направление + было/стало (`currentTarget`) — чтобы фидбэк
 * объяснял КОНКРЕТНО, что изменилось («планка 20→30»), а не абстрактно. null — нет движения.
 */
export type LadderEvent = {
  direction: 'raised' | 'lowered';
  prevTarget: number;
  newTarget: number;
} | null;

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
   * @param _configService Конфиг (число retry для CAS).
   */
  public constructor(
    private readonly _habits: AccentHabitDomainService,
    private readonly _configService: ConfigService<Env, true>,
  ) {}

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
    // CAS+retry (ADR-0035): читаем привычку (с version), считаем новую лесенку, пишем только
    // если version не изменилась; при конфликте (параллельная правка/complete) — перечитываем.
    const attempts = this._configService.get('OPTIMISTIC_RETRY_ATTEMPTS', { infer: true });
    for (let attempt = 0; attempt < attempts; attempt++) {
      const habit = await this._habits.findOwnedOrNull(habitId, accountId);
      if (!habit || habit.ladder.policy !== 'adaptive') {
        return null;
      }
      const { ladder, event } = this._apply(habit.ladder, performed);
      const written = await this._habits.setLadderCas(habitId, accountId, habit.version, ladder);
      if (written) {
        // TODO: Claude Code: 2026-06-18: 2.9 — при event эмитить ladder.raised/lowered (очки/тосты).
        return event;
      }
    }
    // Не разрешилось за N попыток — лучше не двигать планку, чем затереть чужой апдейт.
    return null;
  }

  /**
   * Чистая подстройка лесенки (без побочных эффектов; алгоритм §7).
   * @param ladder Текущая лесенка.
   * @param performed Сколько сделано.
   * @returns Новая лесенка + событие.
   */
  private _apply(ladder: HabitLadder, performed: number): { ladder: HabitLadder; event: LadderEvent } {
    // Полярность (ADR-0058): по умолчанию/`raise` — «выше лучше»; `lower` — зеркальная ветка.
    return ladder.direction === 'lower'
      ? this._applyLower(ladder, performed)
      : this._applyRaise(ladder, performed);
  }

  /** Ветка «выше — лучше» (дефолт): успех = `performed ≥ currentTarget`, планка растёт ВВЕРХ к `goalTarget`. */
  private _applyRaise(ladder: HabitLadder, performed: number): { ladder: HabitLadder; event: LadderEvent } {
    const step = ladder.step ?? 1;
    const prevTarget = ladder.currentTarget;
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
        event = { direction: 'raised', prevTarget, newTarget: currentTarget };
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
        event = { direction: 'lowered', prevTarget, newTarget: currentTarget };
      }
    }

    return { ladder: { ...ladder, currentTarget, easyStreak, missStreak }, event };
  }

  /**
   * Ветка «ниже/раньше — лучше» (ADR-0058, `direction='lower'`; кейс сна/дедлайна): успех =
   * `performed ≤ currentTarget`; серия лёгких → **ужесточение** (`currentTarget − step` к `goalTarget`,
   * инвариант перевёрнут: `goalTarget ≤ currentTarget ≤ minTarget`); два недобора → мягкое
   * **ослабление** (`currentTarget + step` к `minTarget`). Событие `raised` = стало сложнее (прогресс),
   * `lowered` = смягчение — та же семантика, что в raise (не зависит от знака числа).
   */
  private _applyLower(ladder: HabitLadder, performed: number): { ladder: HabitLadder; event: LadderEvent } {
    const step = ladder.step ?? 1;
    const prevTarget = ladder.currentTarget;
    let { currentTarget, easyStreak, missStreak } = ladder;
    let event: LadderEvent = null;

    if (performed <= currentTarget) {
      // Уложился в цель: копим «лёгкие», при пороге — ужесточаем (двигаем цель ВНИЗ к goalTarget).
      missStreak = 0;
      easyStreak += 1;
      const underCap = ladder.goalTarget === null || currentTarget > ladder.goalTarget;
      if (easyStreak >= EASE_THRESHOLD && underCap) {
        const tightened = currentTarget - step;
        currentTarget = ladder.goalTarget === null ? tightened : Math.max(tightened, ladder.goalTarget);
        easyStreak = 0;
        event = { direction: 'raised', prevTarget, newTarget: currentTarget };
      }
    } else if (performed <= ladder.minTarget) {
      // Минимальная победа (в пределах самого мягкого порога): серия цела, не ужесточаем.
      easyStreak = 0;
      missStreak = 0;
    } else {
      // Недобор (позже мягкого порога): при двух подряд — мягкое ослабление к minTarget.
      easyStreak = 0;
      missStreak += 1;
      if (missStreak >= MISS_THRESHOLD) {
        currentTarget = Math.min(ladder.minTarget, currentTarget + step);
        missStreak = 0;
        event = { direction: 'lowered', prevTarget, newTarget: currentTarget };
      }
    }

    return { ladder: { ...ladder, currentTarget, easyStreak, missStreak }, event };
  }
}

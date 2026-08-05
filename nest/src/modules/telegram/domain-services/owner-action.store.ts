import { Injectable } from '@nestjs/common';

/** Что владелец собирается сделать с заявкой. */
export type OwnerActionKind = 'approve' | 'reject' | 'grant';

/** Ожидание причины к уже выбранному действию. */
export interface PendingOwnerAction {
  /** Выдать код, начислить приглашения или отказать. */
  kind: OwnerActionKind;
  /** По какой заявке. */
  requestId: string;
  /** Сколько приглашений начислить (только у `grant`; иначе 0). */
  amount: number;
  /** Когда нажата кнопка. */
  startedAt: number;
}

/** Сколько ждём причину, прежде чем забыть намерение. */
const TTL_MS = 15 * 60 * 1000;

/**
 * Незавершённое действие владельца: кнопка нажата, причина ещё не написана (2.9.1·11).
 *
 * **В памяти, а не в БД, потому что это не факт, а намерение.** Заявка в базе остаётся
 * `pending` до самого решения; передумал или ушёл — ничего откатывать не надо. Писать в базу
 * «он собирался одобрить» значило бы хранить состояние, которое никого не касается и которое
 * пришлось бы чистить.
 *
 * TTL 15 минут: через четверть часа владелец уже не помнит, какую заявку открывал, и
 * присланный текст скорее относится к чему-то другому — принять его за причину было бы хуже,
 * чем забыть намерение.
 */
@Injectable()
export class OwnerActionStore {
  private readonly _pending = new Map<string, PendingOwnerAction>();

  /**
   * Запоминает намерение.
   * @param chatId Чат владельца.
   * @param kind Действие.
   * @param requestId Заявка.
   * @param amount Сколько приглашений начислить (только у `grant`).
   */
  public start(chatId: string, kind: OwnerActionKind, requestId: string, amount = 0): void {
    this._pending.set(chatId, { kind, requestId, amount, startedAt: Date.now() });
  }

  /**
   * Забирает намерение (одноразово).
   * @param chatId Чат владельца.
   * @returns Намерение или null, если его нет или оно протухло.
   */
  public take(chatId: string): PendingOwnerAction | null {
    const action = this._pending.get(chatId);
    if (action === undefined) {
      return null;
    }
    this._pending.delete(chatId);
    return Date.now() - action.startedAt > TTL_MS ? null : action;
  }

  /**
   * Отменяет намерение.
   * @param chatId Чат владельца.
   */
  public forget(chatId: string): void {
    this._pending.delete(chatId);
  }
}

import { Injectable } from '@nestjs/common';

/** Сколько ждём код, прежде чем забыть намерение. */
const TTL_MS = 10 * 60 * 1000;

/**
 * Ожидание кода привязки после голой команды `/link` (2.9.1·14).
 *
 * **В памяти, а не в БД:** это намерение, живущее минуты, и терять его при рестарте не жалко —
 * человек просто наберёт `/link` заново. Тот же принцип, что у черновиков заявок и у ожидания
 * причины у владельца.
 *
 * TTL совпадает со сроком жизни самого кода (10 минут): ждать ответа дольше, чем действует то,
 * чего ждём, бессмысленно.
 */
@Injectable()
export class LinkWaitStore {
  private readonly _waiting = new Map<string, number>();

  /**
   * Запоминает, что от чата ждём код.
   * @param chatId Чат.
   */
  public start(chatId: string): void {
    this._waiting.set(chatId, Date.now());
  }

  /**
   * Забирает ожидание (одноразово).
   * @param chatId Чат.
   * @returns `true`, если ждали код и ожидание ещё живо.
   */
  public take(chatId: string): boolean {
    const startedAt = this._waiting.get(chatId);
    if (startedAt === undefined) {
      return false;
    }
    this._waiting.delete(chatId);
    return Date.now() - startedAt <= TTL_MS;
  }

  /**
   * Отменяет ожидание (`/cancel`, другая команда).
   * @param chatId Чат.
   */
  public forget(chatId: string): void {
    this._waiting.delete(chatId);
  }
}

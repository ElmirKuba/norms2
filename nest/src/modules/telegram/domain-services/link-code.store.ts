import { Injectable, Logger } from '@nestjs/common';

/** Сколько живёт код привязки. */
const TTL_MS = 10 * 60 * 1000;

/** Как часто выметаем протухшее. */
const SWEEP_MS = 2 * 60 * 1000;

/**
 * Алфавит кода — **без похожих символов**.
 *
 * Код человек переписывает глазами из браузера в Telegram, поэтому `0/O`, `1/I/l` и `5/S` из него
 * убраны: перепутанная буква здесь стоит не опечатки, а «код не подошёл, попробуй ещё раз».
 */
const ALPHABET = 'ABCDEFGHJKMNPQRTUVWXYZ2346789';

/** Длина кода. */
const CODE_LENGTH = 6;

/** Выданный, но ещё не использованный код. */
interface PendingLinkCode {
  /** Кому он принадлежит. */
  accountId: string;
  /** Когда выдан. */
  issuedAt: number;
}

/**
 * Одноразовые коды привязки чата к аккаунту (2.9.1·14).
 *
 * **В памяти процесса, а не в БД** — по той же причине, что и черновики заявок: код не факт, а
 * намерение, живущее минуты. Строка в базе появляется, только когда привязка состоялась.
 * Рестарт посреди привязки означает «нажми кнопку ещё раз» — цена честная и названная.
 *
 * **Код одноразовый и живёт 10 минут.** Долгоживущий код — это пароль от чужого аккаунта: кто
 * угодно, увидев его через плечо или в скриншоте, привязал бы свой чат и получал бы приглашения
 * от имени человека.
 */
@Injectable()
export class LinkCodeStore {
  private readonly _logger = new Logger('TelegramLinkCode');
  private readonly _codes = new Map<string, PendingLinkCode>();

  public constructor() {
    setInterval(() => this._sweep(), SWEEP_MS).unref();
  }

  /**
   * Выдаёт аккаунту новый код, отменяя его прежний.
   *
   * Прежний отменяется намеренно: два действующих кода у одного человека — два способа привязать
   * чужой чат, а польза от них нулевая.
   * @param accountId Аккаунт.
   * @returns Код для показа человеку.
   */
  public issue(accountId: string): string {
    for (const [code, pending] of this._codes) {
      if (pending.accountId === accountId) {
        this._codes.delete(code);
      }
    }
    const code = this._generate();
    this._codes.set(code, { accountId, issuedAt: Date.now() });
    return code;
  }

  /**
   * Забирает код (одноразово) и отдаёт аккаунт, которому он принадлежал.
   * @param codeRaw Что прислал человек.
   * @returns Идентификатор аккаунта или null, если код неизвестен или протух.
   */
  public consume(codeRaw: string): string | null {
    const code = codeRaw.trim().toUpperCase();
    const pending = this._codes.get(code);
    if (pending === undefined) {
      return null;
    }
    this._codes.delete(code);
    return Date.now() - pending.issuedAt > TTL_MS ? null : pending.accountId;
  }

  /** Сколько секунд живёт свежий код (для подсказки на экране). */
  public get ttlSeconds(): number {
    return TTL_MS / 1000;
  }

  /**
   * Генерирует код, не совпадающий с уже выданным.
   * @returns Код.
   */
  private _generate(): string {
    let code = '';
    do {
      code = '';
      for (let index = 0; index < CODE_LENGTH; index += 1) {
        code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      }
    } while (this._codes.has(code));
    return code;
  }

  /** Выметает протухшие коды. */
  private _sweep(): void {
    const now = Date.now();
    let removed = 0;
    for (const [code, pending] of this._codes) {
      if (now - pending.issuedAt > TTL_MS) {
        this._codes.delete(code);
        removed += 1;
      }
    }
    if (removed > 0) {
      this._logger.log(`Выметено протухших кодов привязки: ${removed}.`);
    }
  }
}

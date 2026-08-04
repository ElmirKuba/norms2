import type { TelegramRequestBase } from './telegram-request-base.interface';

/**
 * TelegramRequestFull — полная строка `telegram_requests` (≈ строка БД, ADR-0033).
 */
export interface TelegramRequestFull extends TelegramRequestBase {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда заявка создана — от неё же считается протухание через 7 дней. */
  createdAt: Date;
  /** Когда изменена. */
  updatedAt: Date;
}

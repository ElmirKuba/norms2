import type { TelegramRequestPure } from './telegram-request-pure.interface';

/**
 * TelegramRequestBase — Pure + связи и момент решения (ADR-0033).
 */
export interface TelegramRequestBase extends TelegramRequestPure {
  /**
   * Аккаунт заявителя — только у `more_invites`, из привязки `telegram_links`.
   * У `join` всегда null: аккаунта ещё нет.
   *
   * **Берётся из привязки, а не со слов человека.** «Я такой-то, начислите мне» — это заявка на
   * чужую квоту; начислять по словам нельзя.
   */
  accountId: string | null;
  /** Выданный по заявке код приглашения (у одобренных `join`) или null. */
  inviteCodeId: string | null;
  /** Когда владелец закрыл заявку, или null у `pending`. */
  decidedAt: Date | null;
}

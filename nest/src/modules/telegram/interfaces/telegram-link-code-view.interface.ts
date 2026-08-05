/** Одноразовый код привязки, выданный личному кабинету (2.9.1·14). */
export interface TelegramLinkCodeView {
  /** Сам код — человек переписывает его боту. */
  code: string;
  /** Сколько секунд он действует. */
  expiresInSeconds: number;
}

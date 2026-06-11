/**
 * ActiveBanDetail — активный бан против цели с ИМЕНЕМ банившего (join accounts):
 * для экрана «вы забанены» (кто/за что, ADR-0012). Денормализованная проекция
 * (не доменная сущность) — отдаётся в `details.bans` конверта ACCOUNT_BANNED.
 */
export interface ActiveBanDetail {
  /** FK банившего. */
  bannerId: string;
  /** Логин банившего. */
  bannerLogin: string;
  /** Псевдоним банившего. */
  bannerAlias: string;
  /** Причина бана. */
  reason: string;
}

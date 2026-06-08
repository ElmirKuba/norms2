import type { BanView } from './ban-view.interface';

/**
 * BanListItem — строка списка «мои баны» (GET /bans): BanView + login/alias цели
 * из join accounts. Имена нужны только в списке (показать кого забанил); при
 * создании бана банящий цель уже знает, поэтому POST /bans остаётся на BanView
 * (без лишнего фетча аккаунта).
 */
export type BanListItem = BanView & {
  /** Логин цели. */
  targetLogin: string;
  /** Псевдоним цели. */
  targetAlias: string;
};

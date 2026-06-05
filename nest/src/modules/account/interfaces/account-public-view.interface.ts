import type { AccountFull } from './account-full.interface';

/**
 * AccountPublicView — публичная проекция профиля (чужой `GET /accounts/:login`):
 * только `login`, `alias`, `avatar`. Приватное (квота, K, таймзона, метки) не
 * уходит наружу другим участникам.
 */
export type AccountPublicView = Pick<AccountFull, 'login' | 'alias' | 'avatar'>;

import type { AccountFull } from './account-full.interface';

/**
 * AccountPublicView — публичная проекция профиля (чужой `GET /accounts/:login`):
 * `id` (не ПДн — `uuidv7___unixmillis`; нужен как `targetId` для бана из карточки,
 * F3.5), `login`, `alias`, `avatar`. Приватное (квота, K, таймзона, метки) не
 * уходит наружу другим участникам.
 */
export type AccountPublicView = Pick<AccountFull, 'id' | 'login' | 'alias' | 'avatar'>;

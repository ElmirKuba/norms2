import type { AccountFull } from './account-full.interface';

/**
 * AccountRead — что отдаём наружу: полная строка БЕЗ секретов (ADR-0033).
 * Производное через Omit — поля не переобъявляются. `passwordHash` не уходит в DTO.
 */
export type AccountRead = Omit<AccountFull, 'passwordHash'>;

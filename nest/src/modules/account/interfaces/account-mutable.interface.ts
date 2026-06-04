import type { AccountFull } from './account-full.interface';

/**
 * AccountMutable — поля accounts, изменяемые через профиль (CAS по `version`,
 * ADR-0035). Производное утилитами (ADR-0033). НЕ входят: `id`/`login`/
 * `registrationSource`/`version`/`createdAt` (неизменяемы), `invitesRemaining`
 * (меняется атомарно отдельными методами).
 */
export type AccountMutable = Partial<
  Pick<
    AccountFull,
    'alias' | 'avatar' | 'timezone' | 'passwordHash' | 'recoveryRequiredCount' | 'deactivatedAt' | 'deletedAt'
  >
>;

import type { AccountPure } from './account-pure.interface';

/**
 * AccountBase — Pure + поля, нужные для создания строки: хеш пароля, источник
 * регистрации, квота инвайтов, кол-во вопросов восстановления (ADR-0033).
 * Наследует Pure через extends — поля не дублируются.
 */
export interface AccountBase extends AccountPure {
  /** argon2id-хеш пароля. */
  passwordHash: string;
  /** Источник регистрации. */
  registrationSource: 'free' | 'invite' | 'seed';
  /** Остаток квоты инвайтов. */
  invitesRemaining: number;
  /** K вопросов для восстановления (K-of-N) или null. */
  recoveryRequiredCount: number | null;
}

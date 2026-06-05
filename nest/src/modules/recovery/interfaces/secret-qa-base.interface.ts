import type { SecretQaPure } from './secret-qa-pure.interface';

/**
 * SecretQaBase — Pure + связь и секрет, нужные для создания записи (ADR-0033).
 * `answerHash` — здесь (аналогично `passwordHash` у аккаунта): нужен при создании.
 */
export interface SecretQaBase extends SecretQaPure {
  /** FK на accounts.id (владелец вопроса). */
  accountId: string;
  /** argon2id-хеш нормализованного ответа. */
  answerHash: string;
}

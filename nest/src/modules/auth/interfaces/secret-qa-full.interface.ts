/**
 * SecretQaFull — полный контракт строки secret_qa (вопрос восстановления, ADR-0033).
 * Ключи 1:1 с колонками схемы. На этапе A развернём в Pure → Base → Full.
 */
export interface SecretQaFull {
  /** PK. */
  id: string;
  /** FK на accounts.id. */
  accountId: string;
  /** Текст вопроса. */
  question: string;
  /** argon2id-хеш нормализованного ответа. */
  answerHash: string;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён. */
  updatedAt: Date;
}

import type { SecretQaBase } from './secret-qa-base.interface';

/**
 * SecretQaFull — полная строка secret_qa (≈ строка БД, ADR-0033): Base + PK и
 * системные метки. Ключи 1:1 с колонками схемы (defineTableWithSchema).
 */
export interface SecretQaFull extends Required<SecretQaBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён. */
  updatedAt: Date;
}

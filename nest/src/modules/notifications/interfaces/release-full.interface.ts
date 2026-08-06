import type { ReleasePure } from './release-pure.interface';

/**
 * ReleaseFull — полная строка `releases` (≈ строка БД, ADR-0033): Pure + PK и системные метки.
 * Ключи 1:1 с колонками схемы (`defineTableWithSchema`).
 */
export interface ReleaseFull extends ReleasePure {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда строка записана в базу (не дата выпуска — та в `publishedAt`). */
  createdAt: Date;
  /** Когда изменена. */
  updatedAt: Date;
}

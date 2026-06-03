import type { AccountBase } from './account-base.interface';

/**
 * AccountFull — полная строка accounts (≈ строка БД, ADR-0033): Base + PK и
 * системные метки. Ключи 1:1 с колонками схемы (используется в
 * defineTableWithSchema). Nullable — как `| null` (ключ присутствует).
 * `Required<AccountBase>` — по конвенции ADR-0033 (у нас опциональных `?` нет,
 * поэтому фактически no-op, но держим паттерн единым).
 */
export interface AccountFull extends Required<AccountBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Метка обратимой деактивации или null. */
  deactivatedAt: Date | null;
  /** Метка soft-delete или null. */
  deletedAt: Date | null;
  /** Версия для optimistic-lock (ADR-0035). */
  version: number;
  /** Когда создан. */
  createdAt: Date;
  /** Когда последний раз изменён. */
  updatedAt: Date;
}

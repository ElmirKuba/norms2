import type { InviteCodeBase } from './invite-code-base.interface';

/**
 * InviteCodeFull — полная строка invite_codes (≈ строка БД, ADR-0033): Base + PK
 * и системные метки. Ключи 1:1 с колонками схемы (defineTableWithSchema).
 */
export interface InviteCodeFull extends Required<InviteCodeBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён. */
  updatedAt: Date;
}

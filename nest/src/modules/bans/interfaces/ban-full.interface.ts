import type { BanBase } from './ban-base.interface';

/**
 * BanFull — полная строка bans (≈ строка БД, ADR-0033): Base + PK, состояние
 * `active` и системные метки. Ключи 1:1 с колонками схемы (defineTableWithSchema).
 * «Забанен» — производное (EXISTS active, ADR-0012); снятие — active=false.
 */
export interface BanFull extends Required<BanBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Активен ли бан (снятие — active=false, история сохраняется). */
  active: boolean;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён. */
  updatedAt: Date;
}

import type { BanPure } from './ban-pure.interface';

/**
 * BanBase — Pure + связи, нужные для создания записи (ADR-0033). `active` — не
 * здесь: это системное состояние (дефолт true в БД), живёт в Full.
 */
export interface BanBase extends BanPure {
  /** FK на accounts.id — банивший (владелец записи). */
  bannerId: string;
  /** FK на accounts.id — цель бана. */
  targetId: string;
}

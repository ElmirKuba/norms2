/**
 * BanFull — полный контракт строки bans (ADR-0033). Ключи 1:1 с колонками схемы.
 * На этапе I развернём в Pure → Base → Full.
 */
export interface BanFull {
  /** PK. */
  id: string;
  /** FK на accounts.id (банивший). */
  bannerId: string;
  /** FK на accounts.id (цель). */
  targetId: string;
  /** Причина. */
  reason: string;
  /** Активен ли бан (снятие — active=false). */
  active: boolean;
  /** Когда создан. */
  createdAt: Date;
  /** Когда изменён. */
  updatedAt: Date;
}

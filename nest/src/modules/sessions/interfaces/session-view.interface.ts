/**
 * SessionView — проекция сессии наружу (список устройств). Без секрета
 * (`tokenHash`) и служебного `revokedAt`; `current` — это ли сессия текущего
 * запроса (по `sid` из access-токена, ADR-0041).
 */
export interface SessionView {
  /** PK сессии. */
  id: string;
  /** User-Agent устройства или null. */
  userAgent: string | null;
  /** Когда создана (вход с устройства). */
  createdAt: Date;
  /** Когда истекает refresh. */
  expiresAt: Date;
  /** Текущее устройство (эта сессия = `sid` запроса). */
  current: boolean;
}

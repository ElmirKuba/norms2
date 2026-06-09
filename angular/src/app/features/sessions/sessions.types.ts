// Зеркало подмножества контракта sessions, нужного UI (не шарится с бэком).

/** Сессия-устройство (`GET /sessions`). */
export interface SessionView {
  /** PK сессии. */
  id: string;
  /** User-Agent устройства или null. */
  userAgent: string | null;
  /** Когда создана — вход с устройства (ISO). */
  createdAt: string;
  /** Когда истекает refresh (ISO). */
  expiresAt: string;
  /** Текущее устройство (эта сессия = sid запроса). */
  current: boolean;
}

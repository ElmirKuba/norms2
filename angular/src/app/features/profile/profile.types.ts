// Зеркало подмножества контракта бэка для профиля (типы фронта и бэка не шарятся).

/** Публичная проекция чужого профиля (`GET /accounts/:login`). */
export interface AccountPublicView {
  /** PK (не ПДн) — нужен как `targetId` для бана. */
  id: string;
  /** Логин. */
  login: string;
  /** Псевдоним. */
  alias: string;
  /** Путь к аватарке относительно content/ или null. */
  avatar: string | null;
}

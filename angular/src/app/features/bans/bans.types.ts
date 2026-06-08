// Зеркала подмножества контракта bans, нужного UI (не шарятся с бэком).

/** Ответ `POST /bans` — созданная запись (без имени цели; банящий её знает). */
export interface BanView {
  /** PK записи бана. */
  id: string;
  /** Идентификатор цели. */
  targetId: string;
  /** Причина. */
  reason: string;
  /** Активен ли бан. */
  active: boolean;
  /** Когда поставлен (ISO). */
  createdAt: string;
}

/** Строка списка «мои баны» (`GET /bans`) — с login/alias цели. */
export interface BanListItem extends BanView {
  /** Логин цели. */
  targetLogin: string;
  /** Псевдоним цели. */
  targetAlias: string;
}

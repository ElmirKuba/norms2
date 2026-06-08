// Зеркала подмножества контракта invites, нужного UI (не шарятся с бэком).

/** «Кто меня пригласил» (`GET /invites/my-inviter`); null у корней дерева. */
export interface InviterRead {
  /** Логин пригласившего. */
  inviterLogin: string;
  /** Псевдоним пригласившего. */
  inviterAlias: string;
  /** Причина приглашения. */
  reason: string;
  /** Когда приглашён (ISO). */
  invitedAt: string;
}

/**
 * InviterRead — «кто меня пригласил» (GET /invites/my-inviter). Денормализованная
 * проекция ребра invitations × accounts (сторона пригласившего): login/alias
 * берутся из аккаунта-инвайтера. У корней дерева (free/seed) ребра нет → null.
 */
export interface InviterRead {
  /** Логин пригласившего. */
  inviterLogin: string;
  /** Псевдоним пригласившего. */
  inviterAlias: string;
  /** Причина приглашения (из погашенного кода). */
  reason: string;
  /** Когда приглашён (момент погашения кода). */
  invitedAt: Date;
}

/**
 * InviteeRead — строка списка «мои приглашённые» (GET /invites). Денормализованная
 * проекция ребра invitations × accounts (сторона приглашённого): login/alias —
 * из аккаунта приглашённого.
 */
export interface InviteeRead {
  /** Идентификатор приглашённого аккаунта. */
  accountId: string;
  /** Логин приглашённого. */
  login: string;
  /** Псевдоним приглашённого. */
  alias: string;
  /** Причина приглашения. */
  reason: string;
  /** Когда приглашён. */
  invitedAt: Date;
}

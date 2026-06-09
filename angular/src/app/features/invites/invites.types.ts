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

/** Строка списка «мои приглашённые» (`GET /invites`). */
export interface InviteeRead {
  /** Идентификатор приглашённого аккаунта. */
  accountId: string;
  /** Логин приглашённого. */
  login: string;
  /** Псевдоним приглашённого. */
  alias: string;
  /** Причина приглашения. */
  reason: string;
  /** Когда приглашён (ISO). */
  invitedAt: string;
}

/** Узел дерева приглашений (`GET /invites/of/:accountId`) — прямой ребёнок. */
export interface InviteeNode {
  /** Идентификатор приглашённого аккаунта. */
  accountId: string;
  /** Логин. */
  login: string;
  /** Псевдоним. */
  alias: string;
  /** Причина приглашения. */
  reason: string;
  /** Когда приглашён (ISO). */
  invitedAt: string;
  /** Забанен ли этот участник мной (активная запись). */
  bannedByMe: boolean;
}

/** Ответ `GET /invites/can-ban/:accountId` — вправе ли я забанить. */
export interface CanBanResponse {
  /** true, если бан разрешён. */
  allowed: boolean;
}

/** Невыданный код (`GET /invites/codes`, ответ `POST /invites`). */
export interface InviteCodeRead {
  /** PK кода. */
  id: string;
  /** Сам код (для копирования/передачи). */
  code: string;
  /** Причина приглашения. */
  reason: string;
  /** Срок действия (ISO). */
  expiresAt: string;
}

import type { InviteCodePure } from './invite-code-pure.interface';

/**
 * InviteCodeBase — Pure + поля для создания: сам код, создатель, срок (ADR-0033).
 */
export interface InviteCodeBase extends InviteCodePure {
  /** Код приглашения (10 символов, уникален). */
  code: string;
  /** FK на accounts.id (создатель). */
  inviterId: string;
  /** Срок жизни кода. */
  expiresAt: Date;
}

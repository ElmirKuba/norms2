import type { InvitationPure } from './invitation-pure.interface';

/**
 * InvitationBase — Pure + связи и момент погашения (ADR-0033).
 */
export interface InvitationBase extends InvitationPure {
  /** FK приглашённого (уникален → 1:1). */
  accountId: string;
  /** FK пригласившего. */
  inviterId: string;
  /** Момент погашения. */
  invitedAt: Date;
}

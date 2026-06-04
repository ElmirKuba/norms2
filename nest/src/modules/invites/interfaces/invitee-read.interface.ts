import type { InvitationFull } from './invitation-full.interface';

/**
 * InviteeRead — строка списка «мои приглашённые» (GET /invites). Производное из
 * InvitationFull.
 */
export type InviteeRead = Pick<InvitationFull, 'accountId' | 'reason' | 'invitedAt'>;

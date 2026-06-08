import type { InviteCodeFull } from './invite-code-full.interface';

/**
 * InviteCodeRead — строка списка «мои невыданные коды» (GET /invites/codes):
 * id/code/reason/expiresAt. Без inviterId (свой) и системных меток. Производное
 * из Full (ADR-0033).
 */
export type InviteCodeRead = Pick<InviteCodeFull, 'id' | 'code' | 'reason' | 'expiresAt'>;

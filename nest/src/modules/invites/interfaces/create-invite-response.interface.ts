import type { InviteCodeFull } from './invite-code-full.interface';

/** Ответ POST /invites — созданный код (без inviterId). Производное из Full. */
export type CreateInviteResponse = Pick<InviteCodeFull, 'id' | 'code' | 'reason' | 'expiresAt'>;

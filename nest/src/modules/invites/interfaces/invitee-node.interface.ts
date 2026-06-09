import type { InviteeRead } from './invitee-read.interface';

/**
 * InviteeNode — узел дерева приглашений (`GET /invites/of/:accountId`): прямой
 * приглашённый + флаг `bannedByMe` (забанен ли он смотрящим). Производное от
 * InviteeRead (ADR-0033). Дерево раскрывается лениво — по одному узлу.
 */
export type InviteeNode = InviteeRead & {
  /** Забанен ли этот участник текущим пользователем (активная запись). */
  bannedByMe: boolean;
};

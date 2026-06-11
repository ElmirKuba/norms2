import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { InviteDomainService } from '../../invites/domain-services/invite.domain-service';
import { InviteTreeDomainService } from '../../invites/domain-services/invite-tree.domain-service';
import { BanDomainService } from '../../bans/domain-services/ban.domain-service';
import { SessionDomainService } from '../../sessions/domain-services/session.domain-service';
import { SecretQaDomainService } from '../../recovery/domain-services/secret-qa.domain-service';
import type { AccountFull } from '../../account/interfaces/account-full.interface';
import type { OverviewStats } from '../interfaces/overview-stats.interface';

/**
 * Use-case overview-статистики (F4) — единственная точка кросс-домен-агрегации:
 * считает числа из доменов account/invites/invite-tree/bans/sessions/recovery.
 * Реально новых COUNT — два (всего пользователей, поддерево CTE); остальное —
 * длина уже существующих списков (данные «для своих» малы). `invitesRemaining`/
 * `recoveryRequiredCount` — из аккаунта, уже загруженного Guard'ом.
 */
@Injectable()
export class GetOverviewStatsUseCase {
  /**
   * @param _accountDomainService Account (всего пользователей).
   * @param _inviteDomainService Invites (приглашённые, коды).
   * @param _inviteTreeDomainService Дерево (поддерево).
   * @param _banDomainService Bans (мои баны).
   * @param _sessionDomainService Sessions (устройства).
   * @param _secretQaDomainService Recovery (вопросы).
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _inviteDomainService: InviteDomainService,
    private readonly _inviteTreeDomainService: InviteTreeDomainService,
    private readonly _banDomainService: BanDomainService,
    private readonly _sessionDomainService: SessionDomainService,
    private readonly _secretQaDomainService: SecretQaDomainService,
  ) {}

  /**
   * Собирает числа для overview по аккаунту.
   * @param account Текущий аккаунт (из Guard).
   * @returns Агрегаты.
   */
  public async execute(account: AccountFull): Promise<OverviewStats> {
    const me = account.id;
    const [totalUsers, invitees, codes, bans, sessions, subtreeTotal, recoveryQuestions] =
      await Promise.all([
        this._accountDomainService.countActiveUsers(),
        this._inviteDomainService.listInvitees(me),
        this._inviteDomainService.listMyCodes(me),
        this._banDomainService.listMine(me),
        this._sessionDomainService.listActive(me),
        this._inviteTreeDomainService.countDescendants(me),
        this._secretQaDomainService.countQuestions(me),
      ]);

    const activeBanTargets = new Set(bans.filter((ban) => ban.active).map((ban) => ban.targetId));

    // Полезность приглашённых: делим активные баны на МОИХ прямых приглашённых на
    // «забанено мной» и «забанено вышестоящим» (бан против моего приглашённого
    // бывает только от меня или от предка по дереву — isAncestor, ADR-0012/0038).
    const activeBansOnInvitees = await this._banDomainService.listActiveBansForTargets(
      invitees.map((invitee) => invitee.accountId),
    );
    const bannedByMe = new Set<string>();
    const bannedByOther = new Set<string>();
    for (const ban of activeBansOnInvitees) {
      (ban.bannerId === me ? bannedByMe : bannedByOther).add(ban.targetId);
    }
    // Взаимно исключающе: забанен и мной, и вышестоящим → относим к «мной».
    const inviteesBannedByMe = bannedByMe.size;
    const inviteesBannedByAncestor = [...bannedByOther].filter(
      (targetId) => !bannedByMe.has(targetId),
    ).length;

    return {
      totalUsers,
      invitedDirect: invitees.length,
      subtreeTotal,
      inviteesBannedByMe,
      inviteesBannedByAncestor,
      bansActive: activeBanTargets.size,
      pendingCodes: codes.length,
      invitesRemaining: account.invitesRemaining,
      activeSessions: sessions.length,
      recoveryQuestions,
      recoveryRequiredCount: account.recoveryRequiredCount,
    };
  }
}

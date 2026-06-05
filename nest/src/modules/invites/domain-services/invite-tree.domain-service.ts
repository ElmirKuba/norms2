import { Inject, Injectable } from '@nestjs/common';
import { INVITE_TREE_REPOSITORY } from '../adapters/invite-tree-repository.port';
import type { InviteTreeRepositoryPort } from '../adapters/invite-tree-repository.port';

/**
 * Domain-service дерева приглашений. Точка входа кросс-домена ВНИЗ (ADR-0030): её
 * зовёт use-case области bans, чтобы проверить право банить в своём поддереве
 * (ADR-0003). Зависит только от порта.
 */
@Injectable()
export class InviteTreeDomainService {
  /**
   * @param _inviteTreeRepository Порт дерева приглашений.
   */
  public constructor(
    @Inject(INVITE_TREE_REPOSITORY) private readonly _inviteTreeRepository: InviteTreeRepositoryPort,
  ) {}

  /**
   * Является ли `ancestorId` предком `descendantId`.
   * @param ancestorId Кандидат-предок.
   * @param descendantId Кандидат-потомок.
   * @returns true, если предок.
   */
  public async isAncestor(ancestorId: string, descendantId: string): Promise<boolean> {
    return this._inviteTreeRepository.isAncestor(ancestorId, descendantId);
  }
}

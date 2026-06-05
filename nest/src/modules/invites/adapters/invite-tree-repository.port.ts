/** DI-токен порта дерева приглашений (биндится в invites.module). */
export const INVITE_TREE_REPOSITORY = Symbol('INVITE_TREE_REPOSITORY');

/**
 * Порт дерева приглашений (adjacency list + рекурсивный CTE за абстракцией,
 * ADR-0002), БЕЗ ORM. Домен спрашивает «кто кому предок», не зная про SQL.
 */
export interface InviteTreeRepositoryPort {
  /**
   * Является ли `ancestorId` предком `descendantId` (по цепочке `inviter_id`
   * вверх по `invitations`). Право банить в своём поддереве (ADR-0003).
   * @param ancestorId Кандидат-предок (банящий).
   * @param descendantId Кандидат-потомок (цель).
   * @returns true, если есть путь вверх от потомка к предку; false, если равны/нет пути.
   */
  isAncestor(ancestorId: string, descendantId: string): Promise<boolean>;
}

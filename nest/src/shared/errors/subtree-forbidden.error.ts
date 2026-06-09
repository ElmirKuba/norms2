import { DomainError } from './domain.error';

/**
 * Нет права смотреть приглашённых этого узла (узел не я и не в моём поддереве) →
 * HTTP 403, машинный код `SUBTREE_FORBIDDEN` (F3.Д). Граница та же, что у права
 * банить — своё поддерево приглашений.
 */
export class SubtreeForbiddenError extends DomainError {
  /** Машинный код. */
  public readonly code = 'SUBTREE_FORBIDDEN';
  /** HTTP 403 Forbidden. */
  public readonly httpStatus = 403;
}

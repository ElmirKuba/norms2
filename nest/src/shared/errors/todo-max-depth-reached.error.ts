import { DomainError } from './domain.error';

/**
 * Слишком глубокая вложенность подзадач → HTTP 422, код `TODO_MAX_DEPTH_REACHED`.
 *
 * 422, а не 400: тело запроса корректно, нарушено правило домена — то же различие, что у
 * предела глубины дерева целей.
 */
export class TodoMaxDepthReachedError extends DomainError {
  /** Машинный код. */
  public readonly code = 'TODO_MAX_DEPTH_REACHED';
  /** HTTP 422 Unprocessable Entity. */
  public readonly httpStatus = 422;
}

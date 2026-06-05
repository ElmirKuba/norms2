/**
 * Базовая доменная ошибка: несёт машинный `code` и `httpStatus` для единого
 * конверта ошибок. Framework-агностична (без импорта Nest) — статус числом.
 * Конкретные ошибки наследуются и задают code/httpStatus.
 */
export abstract class DomainError extends Error {
  /** Машинный код ошибки (для клиента/i18n). */
  public abstract readonly code: string;
  /** HTTP-статус для конверта ответа. */
  public abstract readonly httpStatus: number;
  /** Доп. структурированные детали для конверта (или undefined). */
  public readonly details: unknown;

  /**
   * @param message Человекочитаемое сообщение.
   * @param details Опц. структурированные детали (попадут в `error.details`).
   */
  public constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

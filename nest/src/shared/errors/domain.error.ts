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

  /**
   * @param message Человекочитаемое сообщение.
   */
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

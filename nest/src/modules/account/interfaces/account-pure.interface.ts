/**
 * AccountPure — содержательные поля аккаунта (смысл), БЕЗ id/FK/системных меток
 * (ADR-0033). Самый нижний слой иерархии типов: каждое поле объявлено здесь один раз.
 */
export interface AccountPure {
  /** Логин (уникален по lower(login)). */
  login: string;
  /** Отображаемое имя (не уникально). */
  alias: string;
  /** Путь к аватарке относительно content/ или null. */
  avatar: string | null;
  /** IANA-таймзона пользователя. */
  timezone: string;
}

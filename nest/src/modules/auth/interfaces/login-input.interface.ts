/**
 * LoginInput — вход сценария login (сырой login/password + userAgent устройства
 * для записи в сессию).
 */
export interface LoginInput {
  /** Логин. */
  login: string;
  /** Пароль-плейнтекст. */
  password: string;
  /** User-Agent устройства или null. */
  userAgent: string | null;
}

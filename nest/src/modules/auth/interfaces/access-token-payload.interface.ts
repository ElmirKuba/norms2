/**
 * Полезная нагрузка access-JWT. `sub` — id аккаунта (стандартный claim).
 * iat/exp добавляет/проверяет сама библиотека JWT.
 */
export interface AccessTokenPayload {
  /** Subject — идентификатор аккаунта. */
  sub: string;
}

/**
 * Полезная нагрузка access-JWT. `sub` — id аккаунта, `sid` — id текущей сессии
 * (для пометки/отзыва «текущего устройства», ADR-0041). iat/exp — сама JWT-либа.
 */
export interface AccessTokenPayload {
  /** Subject — идентификатор аккаунта. */
  sub: string;
  /** Session id — идентификатор сессии (стабилен через ротацию refresh). */
  sid: string;
}

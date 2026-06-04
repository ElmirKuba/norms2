/**
 * AuthTokens — пара токенов после login/refresh. access уходит в тело ответа
 * (клиент держит в памяти), refresh — в httpOnly-cookie (ставит контроллер).
 */
export interface AuthTokens {
  /** Access-JWT (stateless). */
  accessToken: string;
  /** Refresh-токен (plaintext, для cookie). */
  refreshToken: string;
}

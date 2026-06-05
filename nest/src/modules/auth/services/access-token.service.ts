import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '../interfaces/access-token-payload.interface';

/**
 * Сервис access-токена (stateless JWT). Секрет и TTL заданы в JwtModule
 * (auth.module: `JWT_ACCESS_SECRET`/`ACCESS_TTL`). Подписывает токен с `sub`=id
 * аккаунта и `sid`=id сессии; проверяет его. Refresh-токен — отдельно, в БД.
 */
@Injectable()
export class AccessTokenService {
  /**
   * @param _jwtService JWT-сервис (настроен в JwtModule).
   */
  public constructor(private readonly _jwtService: JwtService) {}

  /**
   * Подписывает access-токен для аккаунта и его текущей сессии.
   * @param accountId Идентификатор аккаунта.
   * @param sessionId Идентификатор сессии (ADR-0041).
   * @returns Подписанный JWT.
   */
  public sign(accountId: string, sessionId: string): string {
    return this._jwtService.sign({ sub: accountId, sid: sessionId } satisfies AccessTokenPayload);
  }

  /**
   * Проверяет access-токен и возвращает id аккаунта и сессии.
   * @param token JWT из заголовка Authorization.
   * @returns `{ accountId, sessionId }` из claim'ов `sub`/`sid`.
   * @throws {Error} Если токен невалиден или истёк (ловит вызывающий — Guard → 401).
   */
  public verify(token: string): { accountId: string; sessionId: string } {
    const payload = this._jwtService.verify<AccessTokenPayload>(token);
    return { accountId: payload.sub, sessionId: payload.sid };
  }
}

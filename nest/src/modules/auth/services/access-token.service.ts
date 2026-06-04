import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '../interfaces/access-token-payload.interface';

/**
 * Сервис access-токена (stateless JWT). Секрет и TTL заданы в JwtModule
 * (auth.module: `JWT_ACCESS_SECRET`/`ACCESS_TTL`). Подписывает токен с `sub`=id
 * аккаунта и проверяет его. Refresh-токен — отдельно, в БД (sessions).
 */
@Injectable()
export class AccessTokenService {
  /**
   * @param _jwtService JWT-сервис (настроен в JwtModule).
   */
  public constructor(private readonly _jwtService: JwtService) {}

  /**
   * Подписывает access-токен для аккаунта.
   * @param accountId Идентификатор аккаунта.
   * @returns Подписанный JWT.
   */
  public sign(accountId: string): string {
    return this._jwtService.sign({ sub: accountId } satisfies AccessTokenPayload);
  }

  /**
   * Проверяет access-токен и возвращает id аккаунта.
   * @param token JWT из заголовка Authorization.
   * @returns Идентификатор аккаунта (claim `sub`).
   * @throws {Error} Если токен невалиден или истёк (ловит вызывающий — Guard → 401).
   */
  public verify(token: string): string {
    const payload = this._jwtService.verify<AccessTokenPayload>(token);
    return payload.sub;
  }
}

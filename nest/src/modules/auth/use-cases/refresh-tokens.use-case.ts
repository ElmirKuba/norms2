import { Injectable } from '@nestjs/common';
import { SessionDomainService } from '../../sessions/domain-services/session.domain-service';
import { AccessTokenService } from '../services/access-token.service';
import { InvalidRefreshError } from '../../../shared/errors/invalid-refresh.error';
import type { AuthTokens } from '../interfaces/auth-tokens.interface';

/**
 * Use-case обновления токенов: ротирует сессию по refresh-cookie (CAS,
 * reuse-detect → revoke all внутри sessions) и выдаёт новые access+refresh.
 */
@Injectable()
export class RefreshTokensUseCase {
  /**
   * @param _sessionDomainService Domain-service sessions (ротация).
   * @param _accessTokenService Сервис access-JWT.
   */
  public constructor(
    private readonly _sessionDomainService: SessionDomainService,
    private readonly _accessTokenService: AccessTokenService,
  ) {}

  /**
   * Обновляет токены.
   * @param refreshToken Плейнтекст refresh из cookie (или undefined).
   * @returns Новая пара токенов.
   * @throws {InvalidRefreshError} Если cookie нет или токен недействителен.
   */
  public async execute(refreshToken: string | undefined): Promise<AuthTokens> {
    if (refreshToken === undefined) {
      throw new InvalidRefreshError('Refresh-токен отсутствует.');
    }
    const rotated = await this._sessionDomainService.rotateSession(refreshToken);
    const accessToken = this._accessTokenService.sign(rotated.accountId);
    return { accessToken, refreshToken: rotated.refreshToken };
  }
}

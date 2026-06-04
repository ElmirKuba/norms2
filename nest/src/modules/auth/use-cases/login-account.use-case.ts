import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { SessionDomainService } from '../../sessions/domain-services/session.domain-service';
import { AccessTokenService } from '../services/access-token.service';
import type { LoginInput } from '../interfaces/login-input.interface';
import type { AuthTokens } from '../interfaces/auth-tokens.interface';

/**
 * Use-case входа: проверяет учётные данные (кросс-домен ВНИЗ → account), затем
 * выдаёт access-JWT и создаёт сессию (refresh, кросс-домен ВНИЗ → sessions).
 */
@Injectable()
export class LoginAccountUseCase {
  /**
   * @param _accountDomainService Domain-service account (аутентификация).
   * @param _sessionDomainService Domain-service sessions (создание refresh).
   * @param _accessTokenService Сервис access-JWT.
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _sessionDomainService: SessionDomainService,
    private readonly _accessTokenService: AccessTokenService,
  ) {}

  /**
   * Выполняет вход.
   * @param input Логин/пароль + userAgent.
   * @returns Пара токенов (access — в тело, refresh — в cookie).
   * @throws {BadCredentialsError} При неверных данных/запрете входа.
   */
  public async execute(input: LoginInput): Promise<AuthTokens> {
    const account = await this._accountDomainService.authenticate(input.login, input.password);
    const accessToken = this._accessTokenService.sign(account.id);
    const refreshToken = await this._sessionDomainService.createSession(account.id, input.userAgent);
    return { accessToken, refreshToken };
  }
}

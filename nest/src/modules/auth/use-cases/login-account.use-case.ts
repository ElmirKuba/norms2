import { Injectable } from '@nestjs/common';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { SessionDomainService } from '../../sessions/domain-services/session.domain-service';
import { BanDomainService } from '../../bans/domain-services/ban.domain-service';
import { AccessTokenService } from '../services/access-token.service';
import { AccountBannedError } from '../../../shared/errors/account-banned.error';
import type { LoginInput } from '../interfaces/login-input.interface';
import type { AuthTokens } from '../interfaces/auth-tokens.interface';

/**
 * Use-case входа: проверяет учётные данные (кросс-домен ВНИЗ → account),
 * блокирует при активном бане (кросс-домен ВНИЗ → bans, ADR-0003/0012), затем
 * выдаёт access-JWT и создаёт сессию (refresh, кросс-домен ВНИЗ → sessions).
 */
@Injectable()
export class LoginAccountUseCase {
  /**
   * @param _accountDomainService Domain-service account (аутентификация).
   * @param _sessionDomainService Domain-service sessions (создание refresh).
   * @param _banDomainService Domain-service bans (бан-чек).
   * @param _accessTokenService Сервис access-JWT.
   */
  public constructor(
    private readonly _accountDomainService: AccountDomainService,
    private readonly _sessionDomainService: SessionDomainService,
    private readonly _banDomainService: BanDomainService,
    private readonly _accessTokenService: AccessTokenService,
  ) {}

  /**
   * Выполняет вход.
   * @param input Логин/пароль + userAgent.
   * @returns Пара токенов (access — в тело, refresh — в cookie).
   * @throws {BadCredentialsError} При неверных данных/запрете входа.
   * @throws {AccountBannedError} Если есть активный бан (с деталями кто/за что).
   */
  public async execute(input: LoginInput): Promise<AuthTokens> {
    const account = await this._accountDomainService.authenticate(input.login, input.password);
    const activeBans = await this._banDomainService.listActiveAgainst(account.id);
    if (activeBans.length > 0) {
      throw new AccountBannedError('Вход заблокирован: вы забанены.', activeBans);
    }
    const accessToken = this._accessTokenService.sign(account.id);
    const refreshToken = await this._sessionDomainService.createSession(account.id, input.userAgent);
    return { accessToken, refreshToken };
  }
}

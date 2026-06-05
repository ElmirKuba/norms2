import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenService } from '../services/access-token.service';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import { BanDomainService } from '../../bans/domain-services/ban.domain-service';
import { AccountBannedError } from '../../../shared/errors/account-banned.error';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Guard защищённых роутов: читает `Authorization: Bearer <access>`, проверяет
 * JWT, грузит активный аккаунт и блокирует при активном бане (деактивация/бан
 * учитываются на КАЖДОМ запросе — действуют немедленно в окне access-токена,
 * ADR-0038). Кладёт аккаунт в `request.account`. Токен-проблема → 401, бан → 403.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * @param _accessTokenService Сервис проверки access-JWT.
   * @param _accountDomainService Domain-service account (загрузка активного аккаунта).
   * @param _banDomainService Domain-service bans (бан-чек на каждый запрос).
   */
  public constructor(
    private readonly _accessTokenService: AccessTokenService,
    private readonly _accountDomainService: AccountDomainService,
    private readonly _banDomainService: BanDomainService,
  ) {}

  /**
   * Пропускает запрос только при валидном access-токене и активном аккаунте.
   * @param context Контекст выполнения.
   * @returns true, если доступ разрешён.
   * @throws {UnauthorizedException} Если токен отсутствует/невалиден.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this._extractBearer(request);
    if (token === null) {
      throw new UnauthorizedException('Нет access-токена.');
    }

    let accountId: string;
    let sessionId: string;
    try {
      ({ accountId, sessionId } = this._accessTokenService.verify(token));
    } catch {
      throw new UnauthorizedException('Невалидный access-токен.');
    }

    // Бросит BadCredentialsError (401), если аккаунт удалён/деактивирован.
    const account = await this._accountDomainService.getActiveById(accountId);
    // Бан действует немедленно (на каждом запросе, ADR-0038).
    const activeBans = await this._banDomainService.listActiveAgainst(account.id);
    if (activeBans.length > 0) {
      throw new AccountBannedError('Доступ заблокирован: вы забанены.', activeBans);
    }
    (request as AuthenticatedRequest).account = account;
    (request as AuthenticatedRequest).sessionId = sessionId;
    return true;
  }

  /**
   * Извлекает Bearer-токен из заголовка Authorization.
   * @param request Запрос.
   * @returns Токен или null.
   */
  private _extractBearer(request: Request): string | null {
    const header = request.headers.authorization;
    if (header === undefined) {
      return null;
    }
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' && value !== undefined && value !== '' ? value : null;
  }
}

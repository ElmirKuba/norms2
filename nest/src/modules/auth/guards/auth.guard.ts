import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenService } from '../services/access-token.service';
import { AccountDomainService } from '../../account/domain-services/account.domain-service';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Guard защищённых роутов: читает `Authorization: Bearer <access>`, проверяет
 * JWT, грузит активный аккаунт (деактивация/бан учитываются на каждом запросе)
 * и кладёт его в `request.account`. Любая проблема → 401.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * @param _accessTokenService Сервис проверки access-JWT.
   * @param _accountDomainService Domain-service account (загрузка активного аккаунта).
   */
  public constructor(
    private readonly _accessTokenService: AccessTokenService,
    private readonly _accountDomainService: AccountDomainService,
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
    try {
      accountId = this._accessTokenService.verify(token);
    } catch {
      throw new UnauthorizedException('Невалидный access-токен.');
    }

    // Бросит BadCredentialsError (401), если аккаунт удалён/деактивирован.
    const account = await this._accountDomainService.getActiveById(accountId);
    (request as AuthenticatedRequest).account = account;
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

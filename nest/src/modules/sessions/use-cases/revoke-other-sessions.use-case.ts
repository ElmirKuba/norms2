import { Injectable } from '@nestjs/common';
import { SessionDomainService } from '../domain-services/session.domain-service';

/**
 * Use-case «выйти на остальных устройствах»: отзывает все сессии аккаунта, кроме
 * текущей (sid из access-токена).
 */
@Injectable()
export class RevokeOtherSessionsUseCase {
  /**
   * @param _sessionDomainService Domain-service sessions.
   */
  public constructor(private readonly _sessionDomainService: SessionDomainService) {}

  /**
   * Отзывает все сессии, кроме текущей.
   * @param accountId Владелец (из Guard).
   * @param currentSessionId Текущая сессия (sid; не отзывать).
   * @returns Промис завершения.
   */
  public async execute(accountId: string, currentSessionId: string): Promise<void> {
    await this._sessionDomainService.revokeOthers(accountId, currentSessionId);
  }
}

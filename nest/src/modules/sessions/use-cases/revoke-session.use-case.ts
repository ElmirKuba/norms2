import { Injectable } from '@nestjs/common';
import { SessionDomainService } from '../domain-services/session.domain-service';

/**
 * Use-case отзыва своей сессии (выход с конкретного устройства). Можно отозвать и
 * текущую — клиент после этого окажется без refresh (на следующем refresh — 401).
 */
@Injectable()
export class RevokeSessionUseCase {
  /**
   * @param _sessionDomainService Domain-service sessions.
   */
  public constructor(private readonly _sessionDomainService: SessionDomainService) {}

  /**
   * Отзывает свою сессию.
   * @param sessionId Идентификатор сессии.
   * @param accountId Владелец (из Guard).
   * @returns Промис завершения.
   * @throws {SessionNotFoundError} Если сессия не найдена/не своя/уже отозвана.
   */
  public async execute(sessionId: string, accountId: string): Promise<void> {
    await this._sessionDomainService.revokeOwn(sessionId, accountId);
  }
}

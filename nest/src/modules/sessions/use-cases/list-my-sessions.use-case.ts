import { Injectable } from '@nestjs/common';
import { SessionDomainService } from '../domain-services/session.domain-service';
import type { SessionView } from '../interfaces/session-view.interface';

/**
 * Use-case «мои устройства»: активные сессии аккаунта, спроецированные в
 * SessionView (без секрета), с пометкой `current` по sid текущего запроса.
 */
@Injectable()
export class ListMySessionsUseCase {
  /**
   * @param _sessionDomainService Domain-service sessions.
   */
  public constructor(private readonly _sessionDomainService: SessionDomainService) {}

  /**
   * Возвращает активные сессии.
   * @param accountId Владелец (из Guard).
   * @param currentSessionId Id текущей сессии (sid из access-токена).
   * @returns Проекции сессий.
   */
  public async execute(accountId: string, currentSessionId: string): Promise<SessionView[]> {
    const sessions = await this._sessionDomainService.listActive(accountId);
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: session.id === currentSessionId,
    }));
  }
}

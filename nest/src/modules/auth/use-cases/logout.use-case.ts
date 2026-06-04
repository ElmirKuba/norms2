import { Injectable } from '@nestjs/common';
import { SessionDomainService } from '../../sessions/domain-services/session.domain-service';

/**
 * Use-case выхода: отзывает сессию по refresh-cookie. Идемпотентно (нет
 * cookie — нечего отзывать). Очистку cookie делает контроллер.
 */
@Injectable()
export class LogoutUseCase {
  /**
   * @param _sessionDomainService Domain-service sessions (отзыв).
   */
  public constructor(private readonly _sessionDomainService: SessionDomainService) {}

  /**
   * Выполняет выход.
   * @param refreshToken Плейнтекст refresh из cookie (или undefined).
   * @returns Промис завершения.
   */
  public async execute(refreshToken: string | undefined): Promise<void> {
    if (refreshToken !== undefined) {
      await this._sessionDomainService.revokeSession(refreshToken);
    }
  }
}

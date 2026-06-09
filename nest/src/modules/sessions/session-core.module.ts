import { Module } from '@nestjs/common';
import { SESSION_REPOSITORY } from './adapters/session-repository.port';
import { SessionRepository } from '../../database/repositories/session/session.repository';
import { SessionDomainService } from './domain-services/session.domain-service';

/**
 * Ядро области sessions: `SessionDomainService` + биндинг репозитория, БЕЗ
 * зависимости от `AccessControlModule`. Выделено, чтобы проверку живости сессии
 * мог использовать и Guard (в `AccessControlModule`, немедленный отзыв доступа —
 * ADR-0043), и auth-флоу (login/refresh/logout) без цикла модулей (зеркало
 * `BanCoreModule`, ADR-0038): фича-модуль `SessionsModule` (контроллер) импортирует
 * AccessControl, а Guard — это ядро; общая зависимость не должна замыкать граф.
 */
@Module({
  providers: [
    { provide: SESSION_REPOSITORY, useClass: SessionRepository },
    SessionDomainService,
  ],
  exports: [SessionDomainService],
})
export class SessionCoreModule {}

import { Module } from '@nestjs/common';
import { AccessControlModule } from '../auth/access-control.module';
import { SESSION_REPOSITORY } from './adapters/session-repository.port';
import { SessionRepository } from '../../database/repositories/session/session.repository';
import { SessionDomainService } from './domain-services/session.domain-service';
import { SessionsController } from './controllers/sessions.controller';
import { ListMySessionsUseCase } from './use-cases/list-my-sessions.use-case';
import { RevokeSessionUseCase } from './use-cases/revoke-session.use-case';
import { RevokeOtherSessionsUseCase } from './use-cases/revoke-other-sessions.use-case';

/**
 * Модуль области sessions: биндит `SESSION_REPOSITORY` на Drizzle-реализацию,
 * экспортирует `SessionDomainService` для кросс-домена (login/refresh/logout зовут
 * вниз) и держит контроллер управления устройствами (`/sessions`, под Guard —
 * импорт `AccessControlModule`; цикла нет, AccessControl про sessions не знает).
 */
@Module({
  imports: [AccessControlModule],
  controllers: [SessionsController],
  providers: [
    { provide: SESSION_REPOSITORY, useClass: SessionRepository },
    SessionDomainService,
    ListMySessionsUseCase,
    RevokeSessionUseCase,
    RevokeOtherSessionsUseCase,
  ],
  exports: [SessionDomainService],
})
export class SessionsModule {}

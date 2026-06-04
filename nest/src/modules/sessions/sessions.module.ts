import { Module } from '@nestjs/common';
import { SESSION_REPOSITORY } from './adapters/session-repository.port';
import { SessionRepository } from '../../database/repositories/session/session.repository';
import { SessionDomainService } from './domain-services/session.domain-service';

/**
 * Модуль области sessions — composition root: биндит `SESSION_REPOSITORY` на
 * Drizzle-реализацию и экспортирует `SessionDomainService` для кросс-домена
 * (auth-use-case зовёт его вниз: login/refresh/logout).
 */
@Module({
  providers: [
    { provide: SESSION_REPOSITORY, useClass: SessionRepository },
    SessionDomainService,
  ],
  exports: [SessionDomainService],
})
export class SessionsModule {}

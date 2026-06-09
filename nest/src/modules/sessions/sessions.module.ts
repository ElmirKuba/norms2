import { Module } from '@nestjs/common';
import { AccessControlModule } from '../auth/access-control.module';
import { SessionCoreModule } from './session-core.module';
import { SessionsController } from './controllers/sessions.controller';
import { ListMySessionsUseCase } from './use-cases/list-my-sessions.use-case';
import { RevokeSessionUseCase } from './use-cases/revoke-session.use-case';
import { RevokeOtherSessionsUseCase } from './use-cases/revoke-other-sessions.use-case';

/**
 * Модуль области sessions: контроллер управления устройствами (`/sessions`, под
 * Guard — импорт `AccessControlModule`) + use-cases. Ядро (`SessionDomainService`
 * + репозиторий) вынесено в `SessionCoreModule` (его использует и Guard для проверки
 * живости сессии — ADR-0043, без цикла). Реэкспортит ядро, чтобы прежние импортёры
 * `SessionsModule` (auth/recovery/profile) по-прежнему получали `SessionDomainService`.
 */
@Module({
  imports: [SessionCoreModule, AccessControlModule],
  controllers: [SessionsController],
  providers: [ListMySessionsUseCase, RevokeSessionUseCase, RevokeOtherSessionsUseCase],
  exports: [SessionCoreModule],
})
export class SessionsModule {}

import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AuthModule } from '../auth/auth.module';
import { INVITE_REPOSITORY } from './adapters/invite-repository.port';
import { InviteRepository } from '../../database/repositories/invite/invite.repository';
import { InviteDomainService } from './domain-services/invite.domain-service';
import { InvitesController } from './controllers/invites.controller';
import { CreateInviteUseCase } from './use-cases/create-invite.use-case';
import { RevokeInviteUseCase } from './use-cases/revoke-invite.use-case';
import { CheckInviteCodeUseCase } from './use-cases/check-invite-code.use-case';
import { ListMyInvitesUseCase } from './use-cases/list-my-invites.use-case';

/**
 * Модуль области invites: контроллер + use-cases + domain-service + биндинг
 * репозитория. Импортирует `AccountModule` (кросс-домен вниз: квота) и
 * `AuthModule` (AuthGuard для защищённых роутов). `InviteDomainService`
 * экспортится — пригодится регистрации по коду (I1.5).
 */
@Module({
  imports: [AccountModule, AuthModule],
  controllers: [InvitesController],
  providers: [
    { provide: INVITE_REPOSITORY, useClass: InviteRepository },
    InviteDomainService,
    CreateInviteUseCase,
    RevokeInviteUseCase,
    CheckInviteCodeUseCase,
    ListMyInvitesUseCase,
  ],
  exports: [InviteDomainService],
})
export class InvitesModule {}

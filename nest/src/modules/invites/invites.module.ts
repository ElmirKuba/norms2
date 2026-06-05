import { Module } from '@nestjs/common';
import { AccountModule } from '../account/account.module';
import { AccessControlModule } from '../auth/access-control.module';
import { INVITE_REPOSITORY } from './adapters/invite-repository.port';
import { INVITE_TREE_REPOSITORY } from './adapters/invite-tree-repository.port';
import { InviteRepository } from '../../database/repositories/invite/invite.repository';
import { InviteTreeRepository } from '../../database/repositories/invite-tree/invite-tree.repository';
import { InviteDomainService } from './domain-services/invite.domain-service';
import { InviteTreeDomainService } from './domain-services/invite-tree.domain-service';
import { InvitesController } from './controllers/invites.controller';
import { CreateInviteUseCase } from './use-cases/create-invite.use-case';
import { RevokeInviteUseCase } from './use-cases/revoke-invite.use-case';
import { CheckInviteCodeUseCase } from './use-cases/check-invite-code.use-case';
import { ListMyInvitesUseCase } from './use-cases/list-my-invites.use-case';

/**
 * Модуль области invites: контроллер + use-cases + domain-service + биндинг
 * репозитория. Импортирует `AccountModule` (кросс-домен вниз: квота) и
 * `AccessControlModule` (AuthGuard для защищённых роутов — НЕ `AuthModule`, иначе
 * цикл: auth-флоу зависит от invites ради регистрации по коду, ADR-0037).
 * Экспортит `InviteDomainService` (регистрация по инвайту, I1.5) и
 * `InviteTreeDomainService` (право банить в поддереве — зовёт bans-use-case, I2).
 */
@Module({
  imports: [AccountModule, AccessControlModule],
  controllers: [InvitesController],
  providers: [
    { provide: INVITE_REPOSITORY, useClass: InviteRepository },
    { provide: INVITE_TREE_REPOSITORY, useClass: InviteTreeRepository },
    InviteDomainService,
    InviteTreeDomainService,
    CreateInviteUseCase,
    RevokeInviteUseCase,
    CheckInviteCodeUseCase,
    ListMyInvitesUseCase,
  ],
  exports: [InviteDomainService, InviteTreeDomainService],
})
export class InvitesModule {}

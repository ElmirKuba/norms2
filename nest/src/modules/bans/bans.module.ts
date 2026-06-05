import { Module } from '@nestjs/common';
import { AccessControlModule } from '../auth/access-control.module';
import { InvitesModule } from '../invites/invites.module';
import { BanCoreModule } from './ban-core.module';
import { BansController } from './controllers/bans.controller';
import { BanUserUseCase } from './use-cases/ban-user.use-case';
import { UnbanUserUseCase } from './use-cases/unban-user.use-case';
import { ListMyBansUseCase } from './use-cases/list-my-bans.use-case';

/**
 * Фича-модуль bans: контроллер + use-cases. `BanDomainService`+репозиторий живут
 * в `BanCoreModule` (без зависимости от AccessControl, ADR-0038). Импортирует
 * `AccessControlModule` (Guard), `InvitesModule` (кросс-домен вниз:
 * `InviteTreeDomainService` для права банить) и `BanCoreModule` (логика банов).
 */
@Module({
  imports: [AccessControlModule, InvitesModule, BanCoreModule],
  controllers: [BansController],
  providers: [BanUserUseCase, UnbanUserUseCase, ListMyBansUseCase],
})
export class BansModule {}

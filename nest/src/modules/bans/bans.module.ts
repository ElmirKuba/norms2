import { Module } from '@nestjs/common';
import { AccessControlModule } from '../auth/access-control.module';
import { InvitesModule } from '../invites/invites.module';
import { BAN_REPOSITORY } from './adapters/ban-repository.port';
import { BanRepository } from '../../database/repositories/ban/ban.repository';
import { BanDomainService } from './domain-services/ban.domain-service';
import { BansController } from './controllers/bans.controller';
import { BanUserUseCase } from './use-cases/ban-user.use-case';
import { UnbanUserUseCase } from './use-cases/unban-user.use-case';
import { ListMyBansUseCase } from './use-cases/list-my-bans.use-case';

/**
 * Модуль области bans: контроллер + use-cases + domain-service + биндинг
 * репозитория. Импортирует `AccessControlModule` (Guard + его зависимости) и
 * `InvitesModule` (кросс-домен вниз: `InviteTreeDomainService` для права банить).
 * Цикла нет — invites про bans не знает. `BanDomainService` экспортится — его
 * зовёт login-ban-чек (I2.4).
 */
@Module({
  imports: [AccessControlModule, InvitesModule],
  controllers: [BansController],
  providers: [
    { provide: BAN_REPOSITORY, useClass: BanRepository },
    BanDomainService,
    BanUserUseCase,
    UnbanUserUseCase,
    ListMyBansUseCase,
  ],
  exports: [BanDomainService],
})
export class BansModule {}

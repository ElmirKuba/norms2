import { Module } from '@nestjs/common';
import { BAN_REPOSITORY } from './adapters/ban-repository.port';
import { BanRepository } from '../../database/repositories/ban/ban.repository';
import { BanDomainService } from './domain-services/ban.domain-service';

/**
 * Ядро области bans: `BanDomainService` + биндинг репозитория, БЕЗ зависимости от
 * `AccessControlModule`. Выделено, чтобы бан-чек могли использовать и Guard (в
 * `AccessControlModule`), и login (`AuthModule`) без цикла модулей (ADR-0038):
 * фича-модуль `BansModule` (контроллер) импортирует AccessControl, а Guard —
 * это ядро; общая зависимость не должна замыкать граф.
 */
@Module({
  providers: [
    { provide: BAN_REPOSITORY, useClass: BanRepository },
    BanDomainService,
  ],
  exports: [BanDomainService],
})
export class BanCoreModule {}

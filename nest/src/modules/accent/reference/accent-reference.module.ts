import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { ACCENT_REFERENCE_REPOSITORY } from './adapters/accent-reference-repository.port';
import { AccentReferenceRepository } from '../../../database/repositories/accent/accent-reference.repository';
import { AccentReferenceDomainService } from './domain-services/accent-reference.domain-service';
import { AccentReferenceController } from './controllers/accent-reference.controller';
import { ListDomainsUseCase } from './use-cases/list-domains.use-case';
import { ListAttributesUseCase } from './use-cases/list-attributes.use-case';
import { AccentReferenceSeedService } from './seed/accent-reference-seed.service';

/**
 * Область справочников раздела «Акцент» (мультимодуль, ADR-0050): сферы + RPG-атрибуты.
 * Порт `ACCENT_REFERENCE_REPOSITORY` → Drizzle-репо, `AccentReferenceDomainService`
 * (read-only каталоги), контроллер `GET /accent/domains|/attributes` под AuthGuard
 * (импорт `AccessControlModule`), сид дефолтов на старте (`AccentReferenceSeedService`,
 * идемпотентно). Экспортит domain-service для кросс-домена вниз (селекторы целей/привычек).
 */
@Module({
  imports: [AccessControlModule],
  controllers: [AccentReferenceController],
  providers: [
    { provide: ACCENT_REFERENCE_REPOSITORY, useClass: AccentReferenceRepository },
    AccentReferenceDomainService,
    ListDomainsUseCase,
    ListAttributesUseCase,
    AccentReferenceSeedService,
  ],
  exports: [AccentReferenceDomainService],
})
export class AccentReferenceModule {}

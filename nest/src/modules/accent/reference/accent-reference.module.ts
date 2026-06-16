import { Module } from '@nestjs/common';
import { ACCENT_REFERENCE_REPOSITORY } from './adapters/accent-reference-repository.port';
import { AccentReferenceRepository } from '../../../database/repositories/accent/accent-reference.repository';
import { AccentReferenceDomainService } from './domain-services/accent-reference.domain-service';

/**
 * Область справочников раздела «Акцент» (мультимодуль, ADR-0050): сферы + RPG-атрибуты.
 * Биндит порт `ACCENT_REFERENCE_REPOSITORY` → Drizzle-репо, предоставляет
 * `AccentReferenceDomainService` (read-only каталоги). Экспортит domain-service для
 * кросс-домена вниз (селекторы целей/привычек). Контроллер `GET /accent/domains|/attributes`
 * — 2.1·3, сид дефолтов — 2.1·4.
 */
@Module({
  providers: [
    { provide: ACCENT_REFERENCE_REPOSITORY, useClass: AccentReferenceRepository },
    AccentReferenceDomainService,
  ],
  exports: [AccentReferenceDomainService],
})
export class AccentReferenceModule {}

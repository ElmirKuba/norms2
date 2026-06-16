import { Module } from '@nestjs/common';
import { ACCENT_MICRO_WIN_REPOSITORY } from './adapters/accent-micro-win-repository.port';
import { AccentMicroWinRepository } from '../../../database/repositories/accent/accent-micro-win.repository';
import { AccentMicroWinDomainService } from './domain-services/accent-micro-win.domain-service';

/**
 * Область микро-побед раздела «Акцент» (мультимодуль, ADR-0050): порт
 * `ACCENT_MICRO_WIN_REPOSITORY` → Drizzle-репо, `AccentMicroWinDomainService`
 * (per-account CRUD с инвариантами и владением). Контроллер/use-cases + `complete`
 * — подфазы 2.2·3/·4. Экспортит domain-service для кросс-домена вниз (Recommender 2.7).
 */
@Module({
  providers: [
    { provide: ACCENT_MICRO_WIN_REPOSITORY, useClass: AccentMicroWinRepository },
    AccentMicroWinDomainService,
  ],
  exports: [AccentMicroWinDomainService],
})
export class MicroWinsModule {}

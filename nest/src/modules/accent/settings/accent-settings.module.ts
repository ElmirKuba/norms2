import { Module } from '@nestjs/common';
import { ACCENT_SETTINGS_REPOSITORY } from './adapters/accent-settings-repository.port';
import { AccentSettingsRepository } from '../../../database/repositories/accent/accent-settings.repository';
import { AccentSettingsDomainService } from './domain-services/accent-settings.domain-service';

/**
 * Область настроек/состояния раздела «Акцент» (мультимодуль, ADR-0050): биндит порт
 * `ACCENT_SETTINGS_REPOSITORY` → Drizzle-репо, предоставляет `AccentSettingsDomainService`
 * (пауза-режим). Экспортит domain-service для кросс-домена вниз (серии/ролловер уважают
 * паузу). Контроллер/use-cases (`GET/PATCH /accent/settings`, pause/resume) — подфаза 2.0.0·4.
 */
@Module({
  providers: [
    { provide: ACCENT_SETTINGS_REPOSITORY, useClass: AccentSettingsRepository },
    AccentSettingsDomainService,
  ],
  exports: [AccentSettingsDomainService],
})
export class AccentSettingsModule {}

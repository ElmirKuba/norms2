import { Module } from '@nestjs/common';
import { AccessControlModule } from '../../auth/access-control.module';
import { ACCENT_SETTINGS_REPOSITORY } from './adapters/accent-settings-repository.port';
import { AccentSettingsRepository } from '../../../database/repositories/accent/accent-settings.repository';
import { AccentSettingsDomainService } from './domain-services/accent-settings.domain-service';
import { AccentSettingsController } from './controllers/accent-settings.controller';
import { GetSettingsUseCase } from './use-cases/get-settings.use-case';
import { PauseAccentUseCase } from './use-cases/pause-accent.use-case';
import { ResumeAccentUseCase } from './use-cases/resume-accent.use-case';

/**
 * Область настроек/состояния раздела «Акцент» (мультимодуль, ADR-0050): порт
 * `ACCENT_SETTINGS_REPOSITORY` → Drizzle-репо, `AccentSettingsDomainService`
 * (пауза-режим), контроллер `/accent/settings|pause|resume`. Импортит
 * `AccessControlModule` (AuthGuard). Экспортит domain-service для кросс-домена вниз
 * (серии/ролловер уважают паузу).
 */
@Module({
  imports: [AccessControlModule],
  controllers: [AccentSettingsController],
  providers: [
    { provide: ACCENT_SETTINGS_REPOSITORY, useClass: AccentSettingsRepository },
    AccentSettingsDomainService,
    GetSettingsUseCase,
    PauseAccentUseCase,
    ResumeAccentUseCase,
  ],
  exports: [AccentSettingsDomainService],
})
export class AccentSettingsModule {}

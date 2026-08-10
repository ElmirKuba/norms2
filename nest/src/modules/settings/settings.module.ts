import { Global, Module } from '@nestjs/common';
import { SETTINGS_REPOSITORY } from './adapters/settings-repository.port';
import { SettingsRepository } from '../../database/repositories/settings/settings.repository';
import { SettingsDomainService } from './domain-services/settings.domain-service';

/**
 * Модуль рантайм-настроек (2.9.3·4) — composition root: биндит `SETTINGS_REPOSITORY` на
 * Drizzle-реализацию и раздаёт `SettingsDomainService`.
 *
 * **`@Global` осознанно.** Настройки спрашивают из разных мест (телеграм-адаптер, вебхук,
 * будущая админка), и тащить импорт модуля в каждый — шум без пользы: это инфраструктура
 * уровня конфига, как `ConfigService`.
 */
@Global()
@Module({
  providers: [
    { provide: SETTINGS_REPOSITORY, useClass: SettingsRepository },
    SettingsDomainService,
  ],
  exports: [SettingsDomainService],
})
export class SettingsModule {}

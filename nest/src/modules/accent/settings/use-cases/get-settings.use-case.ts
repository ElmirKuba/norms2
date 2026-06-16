import { Injectable } from '@nestjs/common';
import { AccentSettingsDomainService } from '../domain-services/accent-settings.domain-service';
import type { AccentSettingsView } from '../interfaces/accent-settings-view.interface';

/**
 * Use-case чтения настроек раздела (`GET /accent/settings`). Тонкий: зовёт domain
 * (ленивое создание строки) и проецирует наружу.
 */
@Injectable()
export class GetSettingsUseCase {
  /**
   * @param _settings Domain-service настроек.
   */
  public constructor(private readonly _settings: AccentSettingsDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Проекция настроек.
   */
  public async execute(accountId: string): Promise<AccentSettingsView> {
    const settings = await this._settings.getOrCreate(accountId);
    return { accentPausedFrom: settings.pausedFrom?.toISOString() ?? null };
  }
}

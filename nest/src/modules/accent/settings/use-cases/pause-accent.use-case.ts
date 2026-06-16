import { Injectable } from '@nestjs/common';
import { AccentSettingsDomainService } from '../domain-services/accent-settings.domain-service';

/**
 * Use-case включения паузы-режима (`POST /accent/pause`). Идемпотентно.
 */
@Injectable()
export class PauseAccentUseCase {
  /**
   * @param _settings Domain-service настроек.
   */
  public constructor(private readonly _settings: AccentSettingsDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Промис завершения.
   */
  public async execute(accountId: string): Promise<void> {
    await this._settings.pause(accountId);
  }
}

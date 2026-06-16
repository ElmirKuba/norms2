import { Injectable } from '@nestjs/common';
import { AccentSettingsDomainService } from '../domain-services/accent-settings.domain-service';

/**
 * Use-case снятия паузы-режима (`POST /accent/resume`). Идемпотентно.
 */
@Injectable()
export class ResumeAccentUseCase {
  /**
   * @param _settings Domain-service настроек.
   */
  public constructor(private readonly _settings: AccentSettingsDomainService) {}

  /**
   * @param accountId Идентификатор аккаунта (из Guard).
   * @returns Промис завершения.
   */
  public async execute(accountId: string): Promise<void> {
    await this._settings.resume(accountId);
  }
}

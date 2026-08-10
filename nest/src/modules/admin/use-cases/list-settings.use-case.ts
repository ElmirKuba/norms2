import { Injectable } from '@nestjs/common';
import { SettingsDomainService } from '../../settings/domain-services/settings.domain-service';
import { EDITABLE_SETTINGS } from '../settings-registry';
import type { SettingDescription } from '../../settings/interfaces/setting-description.interface';

/**
 * Список настроек для админки (2.9.3·7).
 *
 * Отдаёт **только редактируемые** ключи: показывать то, что нельзя изменить, значит обещать
 * рычаг, которого нет. Кросс-домен идёт вниз — use-case админки зовёт domain-service настроек,
 * а не их use-case.
 */
@Injectable()
export class ListSettingsUseCase {
  /**
   * @param _settings Доменный сервис настроек.
   */
  public constructor(private readonly _settings: SettingsDomainService) {}

  /**
   * Возвращает описания редактируемых настроек.
   * @returns Настройки с происхождением значения.
   */
  public async execute(): Promise<SettingDescription[]> {
    const all = await this._settings.describeAll();
    return all.filter((setting) => EDITABLE_SETTINGS.has(setting.key));
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { ValidationError } from '../../../shared/errors/validation.error';
import { SettingsDomainService } from '../../settings/domain-services/settings.domain-service';
import { EDITABLE_SETTINGS } from '../settings-registry';
import type { SettingDescription } from '../../settings/interfaces/setting-description.interface';
import type { SettingActor } from '../../settings/interfaces/setting-actor.interface';

/**
 * Изменение рантайм-настройки из админки (2.9.3·7).
 *
 * **Ради этой ручки настройки и переезжали в базу** (·4): переключение действует на живом
 * приложении, без перезапуска и без ssh. Именно её отсутствие оставляло шаг ·4 недоказанным.
 *
 * Журнал пишет `SettingsDomainService` — там же, где происходит запись, а не здесь: иначе
 * изменение из другого места (сида, будущей команды) осталось бы без следа.
 */
@Injectable()
export class UpdateSettingUseCase {
  /**
   * @param _settings Доменный сервис настроек.
   */
  public constructor(private readonly _settings: SettingsDomainService) {}

  /**
   * Записывает значение настройки.
   * @param key Ключ настройки.
   * @param value Новое значение строкой.
   * @param actor Админ, совершающий изменение.
   * @returns Обновлённое описание настройки.
   * @throws {NotFoundException} Если ключ не из белого списка.
   * @throws {ValidationError} Если значение не подходит типу настройки (400).
   */
  public async execute(
    key: string,
    value: string,
    actor: SettingActor,
  ): Promise<SettingDescription> {
    const normalized = key.toLowerCase();
    const type = EDITABLE_SETTINGS.get(normalized);
    if (type === undefined) {
      // Незнакомый ключ — «настройки не существует», а не «нельзя менять»: 404 и здесь ровно
      // по той же причине, что и у отказа в правах.
      throw new NotFoundException();
    }
    if (value !== 'true' && value !== 'false') {
      // `ValidationError`, а не `BadRequestException` с телом-конвертом: конверт собирает
      // глобальный фильтр, и машинный код он достаёт только из `DomainError`.
      throw new ValidationError(`Настройка '${normalized}' булева — ожидается 'true' или 'false'.`);
    }
    await this._settings.setBoolean(normalized, value === 'true', actor);

    const updated = (await this._settings.describeAll()).find(
      (setting) => setting.key === normalized,
    );
    if (updated === undefined) {
      // Недостижимо: ключ есть в белом списке, значит зарегистрирован умолчанием.
      throw new NotFoundException();
    }
    return updated;
  }
}

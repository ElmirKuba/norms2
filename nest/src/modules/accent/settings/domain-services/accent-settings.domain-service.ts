import { Inject, Injectable } from '@nestjs/common';
import { ACCENT_SETTINGS_REPOSITORY } from '../adapters/accent-settings-repository.port';
import type { AccentSettingsRepositoryPort } from '../adapters/accent-settings-repository.port';
import type { AccentSettingsFull } from '../interfaces/accent-settings-full.interface';

/**
 * Domain-service настроек раздела «Акцент»: получить (с ленивым созданием) и
 * пауза-режим. Зависит только от порта репозитория (чистые границы). Экспортится
 * из `AccentSettingsModule` — другие области «Акцента» зовут вниз (напр. серии/
 * ролловер уважают паузу).
 */
@Injectable()
export class AccentSettingsDomainService {
  /**
   * @param _repository Порт репозитория настроек.
   */
  public constructor(
    @Inject(ACCENT_SETTINGS_REPOSITORY) private readonly _repository: AccentSettingsRepositoryPort,
  ) {}

  /**
   * Настройки аккаунта; создаёт строку при первом обращении (ленивое).
   * @param accountId Идентификатор аккаунта.
   * @returns Строка настроек.
   */
  public async getOrCreate(accountId: string): Promise<AccentSettingsFull> {
    return (await this._repository.findByAccount(accountId)) ?? this._repository.create(accountId);
  }

  /**
   * Включает паузу-режим (`paused_from = now`). Идемпотентно (повтор обновит момент).
   * @param accountId Идентификатор аккаунта.
   * @returns Обновлённые настройки.
   */
  public async pause(accountId: string): Promise<AccentSettingsFull> {
    await this.getOrCreate(accountId);
    return this._repository.updatePausedFrom(accountId, new Date());
  }

  /**
   * Снимает паузу-режим (`paused_from = null`). Идемпотентно.
   * @param accountId Идентификатор аккаунта.
   * @returns Обновлённые настройки.
   */
  public async resume(accountId: string): Promise<AccentSettingsFull> {
    await this.getOrCreate(accountId);
    return this._repository.updatePausedFrom(accountId, null);
  }
}

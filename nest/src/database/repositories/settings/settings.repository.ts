import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { appSettings } from '../../schemas/app-settings.schema';
import { generateId } from '../../../shared/utility-level/generate-id.util';
import type { SettingsRepositoryPort } from '../../../modules/settings/adapters/settings-repository.port';
import type { AppSettingFull } from '../../../modules/settings/interfaces/app-setting-full.interface';

/** Drizzle-реализация порта рантайм-настроек (2.9.3·4). */
@Injectable()
export class SettingsRepository implements SettingsRepositoryPort {
  /**
   * @param _database Клиент Drizzle.
   */
  public constructor(@Inject(DRIZZLE) private readonly _database: DrizzleDatabase) {}

  /**
   * Читает все настройки.
   * @returns Все строки.
   */
  public async findAll(): Promise<AppSettingFull[]> {
    return this._database.select().from(appSettings);
  }

  /**
   * Записывает значение по ключу.
   *
   * `on conflict do update` вместо «прочитай и реши»: две одновременные записи иначе дали бы
   * либо дубль, либо потерянное обновление — уникальный индекс по ключу это исключает.
   *
   * @param key Ключ настройки.
   * @param value Значение строкой.
   * @param updatedBy Аккаунт админа или null.
   * @returns Актуальная строка.
   */
  public async upsert(
    key: string,
    value: string,
    updatedBy: string | null,
  ): Promise<AppSettingFull> {
    const [row] = await this._database
      .insert(appSettings)
      .values({ id: generateId(), key, value, updatedBy })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedBy, updatedAt: new Date() },
      })
      .returning();
    if (row === undefined) {
      // Недостижимо: upsert всегда возвращает строку. Проверка нужна типам, а не логике.
      throw new Error(`Настройка '${key}' не записалась`);
    }
    return row;
  }
}

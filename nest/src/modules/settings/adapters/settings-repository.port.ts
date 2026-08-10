import type { AppSettingFull } from '../interfaces/app-setting-full.interface';

/** DI-токен порта репозитория настроек (биндится на реализацию в settings.module). */
export const SETTINGS_REPOSITORY = Symbol('SETTINGS_REPOSITORY');

/**
 * Порт репозитория рантайм-настроек (2.9.3·4) — контракт «что домену нужно от хранилища», БЕЗ ORM.
 */
export interface SettingsRepositoryPort {
  /**
   * Читает все настройки разом — их единицы, и так проще держать кэш целиком.
   * @returns Все строки настроек.
   */
  findAll(): Promise<AppSettingFull[]>;

  /**
   * Записывает значение по ключу (создаёт или обновляет).
   * @param key Ключ настройки.
   * @param value Значение строкой.
   * @param updatedBy Аккаунт админа или null, если ставит система.
   * @returns Актуальная строка настройки.
   */
  upsert(key: string, value: string, updatedBy: string | null): Promise<AppSettingFull>;
}

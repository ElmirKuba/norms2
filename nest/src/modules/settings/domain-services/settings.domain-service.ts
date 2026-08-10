import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SETTINGS_REPOSITORY } from '../adapters/settings-repository.port';
import type { SettingsRepositoryPort } from '../adapters/settings-repository.port';
import type { Env } from '../../../system/config/env.schema';

/** Ключ настройки «бот на паузе» (2.9.3·4). */
export const SETTING_TELEGRAM_BOT_PAUSED = 'telegram.bot.paused';

/**
 * Рантайм-настройки (2.9.3·4): читаются из базы, переключаются админкой **без перезапуска**.
 *
 * **Слоями `.env` → база.** Переменная окружения задаёт значение по умолчанию, строка в базе
 * его перекрывает. Так на новом стенде всё работает из коробки, а на живом — меняется на лету.
 *
 * **Кэш в памяти, инвалидация при записи.** Настройки спрашивают на каждом апдейте бота, а их
 * единицы: ходить в базу каждый раз незачем. Запись обновляет кэш сразу — она идёт через этот
 * же сервис, других путей нет.
 *
 * ⚠️ **Кэш живёт в процессе.** Появится второй экземпляр бэка — их кэши разъедутся, и
 * переключение в одном не увидит другой. Сейчас экземпляр один; когда станет больше, понадобится
 * общий канал инвалидации (или чтение без кэша).
 */
@Injectable()
export class SettingsDomainService implements OnApplicationBootstrap {
  private readonly _logger = new Logger(SettingsDomainService.name);
  private readonly _cache = new Map<string, string>();
  private readonly _defaults = new Map<string, string>();

  /**
   * @param _repository Порт репозитория настроек.
   */
  public constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly _repository: SettingsRepositoryPort,
    configService: ConfigService<Env, true>,
  ) {
    // `.env` — значение по умолчанию; строка в базе его перекрывает (2.9.3·4).
    this.registerDefault(
      SETTING_TELEGRAM_BOT_PAUSED,
      configService.get('TELEGRAM_BOT_PAUSED', { infer: true }) ? 'true' : 'false',
    );
  }

  /** Наполняет кэш на старте. */
  public async onApplicationBootstrap(): Promise<void> {
    await this.reload();
  }

  /**
   * Перечитывает настройки из базы в кэш.
   * @returns Промис завершения.
   */
  public async reload(): Promise<void> {
    try {
      const rows = await this._repository.findAll();
      this._cache.clear();
      for (const row of rows) {
        this._cache.set(row.key.toLowerCase(), row.value);
      }
    } catch (error) {
      // Настройки недоступны — работаем на значениях по умолчанию, а не падаем.
      this._logger.error(`Не удалось прочитать настройки: ${String(error)}`);
    }
  }

  /**
   * Регистрирует значение по умолчанию (обычно из `.env`).
   * @param key Ключ настройки.
   * @param value Значение по умолчанию.
   */
  public registerDefault(key: string, value: string): void {
    this._defaults.set(key.toLowerCase(), value);
  }

  /**
   * Читает булеву настройку.
   * @param key Ключ настройки.
   * @returns Значение из базы, иначе умолчание, иначе false.
   */
  public getBoolean(key: string): boolean {
    const normalized = key.toLowerCase();
    return (this._cache.get(normalized) ?? this._defaults.get(normalized) ?? 'false') === 'true';
  }

  /**
   * Записывает булеву настройку и сразу обновляет кэш.
   * @param key Ключ настройки.
   * @param value Новое значение.
   * @param updatedBy Аккаунт админа или null.
   * @returns Промис завершения.
   */
  public async setBoolean(key: string, value: boolean, updatedBy: string | null): Promise<void> {
    const normalized = key.toLowerCase();
    const asText = value ? 'true' : 'false';
    await this._repository.upsert(normalized, asText, updatedBy);
    this._cache.set(normalized, asText);
    this._logger.log(`Настройка '${normalized}' = ${asText}`);
  }
}

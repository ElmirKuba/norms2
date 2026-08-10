import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SETTINGS_REPOSITORY } from '../adapters/settings-repository.port';
import type { SettingsRepositoryPort } from '../adapters/settings-repository.port';
import type { Env } from '../../../system/config/env.schema';
import type { SettingDescription } from '../interfaces/setting-description.interface';
import type { SettingActor } from '../interfaces/setting-actor.interface';
import {
  AUDIT_ACTIONS,
  AuditDomainService,
} from '../../audit/domain-services/audit.domain-service';

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
   * @param configService Конфиг: значения по умолчанию.
   * @param _audit Журнал действий (2.9.3·6).
   */
  public constructor(
    @Inject(SETTINGS_REPOSITORY) private readonly _repository: SettingsRepositoryPort,
    configService: ConfigService<Env, true>,
    private readonly _audit: AuditDomainService,
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
   * Описывает все известные настройки: действующее значение и его происхождение (2.9.3·7).
   *
   * **`source` — не украшение экрана.** Без него «почему значение такое» не читается: `env`
   * значит «начальное, строки в базе ещё нет», `db` — «перекрыто админкой». Иначе админ видит
   * `false` и не понимает, он это выключил или так было всегда.
   *
   * Перечень идёт от **зарегистрированных умолчаний**, а не от строк в базе: настройка
   * существует потому, что её кто-то читает в коде, а не потому, что кто-то её записал.
   *
   * @returns Описания настроек, по одному на известный ключ.
   */
  public async describeAll(): Promise<SettingDescription[]> {
    const rows = await this._repository.findAll();
    const byKey = new Map(rows.map((row) => [row.key.toLowerCase(), row]));
    return [...this._defaults.entries()].map(([key, fallback]) => {
      const row = byKey.get(key);
      return {
        key,
        value: row?.value ?? fallback,
        source: row === undefined ? ('env' as const) : ('db' as const),
        updatedBy: row?.updatedBy ?? null,
        updatedAt: row?.updatedAt ?? null,
      };
    });
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
   * @param actor Кто меняет: админ или система.
   * @returns Промис завершения.
   */
  public async setBoolean(key: string, value: boolean, actor: SettingActor): Promise<void> {
    const normalized = key.toLowerCase();
    const asText = value ? 'true' : 'false';
    const previous = this.getBoolean(normalized);
    await this._repository.upsert(normalized, asText, actor.accountId);
    this._cache.set(normalized, asText);
    this._logger.log(`Настройка '${normalized}' = ${asText}`);
    // Журнал пишется ПОСЛЕ успешной записи: строка о том, чего не произошло, хуже её отсутствия.
    // Прежнее значение — не для красоты: «включил паузу» и «переключил уже включённую» это
    // разные события, и по журналу они должны различаться (2.9.3·6).
    await this._audit.record({
      action: AUDIT_ACTIONS.SETTING_CHANGED,
      actorAccountId: actor.accountId,
      // Логин снимком обязателен: без него человеческое действие выглядит в журнале как
      // системное — поймано живой проверкой 10.08.2026, когда переключение через админку
      // записалось от «(система)».
      actorLogin: actor.login,
      targetType: 'setting',
      targetId: normalized,
      targetLabel: normalized,
      details: { from: previous ? 'true' : 'false', to: asText },
    });
  }
}

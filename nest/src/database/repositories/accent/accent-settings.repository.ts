import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../client/database.constants';
import type { DrizzleDatabase } from '../../client/database.constants';
import { accentSettings } from '../../schemas/accent-settings.schema';
import type { AccentSettingsRepositoryPort } from '../../../modules/accent/settings/adapters/accent-settings-repository.port';
import type { AccentSettingsFull } from '../../../modules/accent/settings/interfaces/accent-settings-full.interface';

/**
 * Drizzle-реализация порта настроек «Акцента» (единственное место с ORM). Строка
 * `accent_settings` структурно совпадает с `AccentSettingsFull` (колонки 1:1) →
 * маппинг прямой. Биндится на токен `ACCENT_SETTINGS_REPOSITORY` в accent-settings.module.
 */
@Injectable()
export class AccentSettingsRepository implements AccentSettingsRepositoryPort {
  /**
   * @param _db Инстанс Drizzle (DI-токен DRIZZLE).
   */
  public constructor(@Inject(DRIZZLE) private readonly _db: DrizzleDatabase) {}

  /**
   * Находит настройки по аккаунту (PK).
   * @param accountId Идентификатор аккаунта.
   * @returns Строка или null.
   */
  public async findByAccount(accountId: string): Promise<AccentSettingsFull | null> {
    const rows = await this._db
      .select()
      .from(accentSettings)
      .where(eq(accentSettings.accountId, accountId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * Создаёт строку настроек идемпотентно (ленивое создание). При конфликте PK —
   * перечитывает существующую (параллельное первое обращение безопасно).
   * @param accountId Идентификатор аккаунта.
   * @returns Актуальная строка настроек.
   * @throws {Error} Если строку не удалось ни создать, ни найти.
   */
  public async create(accountId: string): Promise<AccentSettingsFull> {
    const rows = await this._db
      .insert(accentSettings)
      .values({ accountId })
      .onConflictDoNothing()
      .returning();
    const inserted = rows[0];
    if (inserted) {
      return inserted;
    }
    const existing = await this.findByAccount(accountId);
    if (!existing) {
      throw new Error('accent_settings: create не вернул строку и существующая не найдена.');
    }
    return existing;
  }

  /**
   * Ставит/снимает паузу (`paused_from`).
   * @param accountId Идентификатор аккаунта.
   * @param value Момент начала паузы или null.
   * @returns Обновлённая строка.
   * @throws {Error} Если строка не найдена.
   */
  public async updatePausedFrom(accountId: string, value: Date | null): Promise<AccentSettingsFull> {
    const rows = await this._db
      .update(accentSettings)
      .set({ pausedFrom: value })
      .where(eq(accentSettings.accountId, accountId))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error('accent_settings: updatePausedFrom не нашёл строку.');
    }
    return row;
  }
}

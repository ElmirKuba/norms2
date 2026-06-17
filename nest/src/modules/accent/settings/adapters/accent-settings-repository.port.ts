import type { AccentSettingsFull } from '../interfaces/accent-settings-full.interface';

/** DI-токен порта репозитория настроек «Акцента» (биндится в accent-settings.module). */
export const ACCENT_SETTINGS_REPOSITORY = Symbol('ACCENT_SETTINGS_REPOSITORY');

/**
 * Порт репозитория настроек раздела «Акцент» (1:1 с account), БЕЗ ORM.
 * Реализация — `database/repositories/accent` (Drizzle).
 */
export interface AccentSettingsRepositoryPort {
  /**
   * Находит настройки по аккаунту.
   * @param accountId Идентификатор аккаунта.
   * @returns Строка настроек или null (ещё не создавались).
   */
  findByAccount(accountId: string): Promise<AccentSettingsFull | null>;

  /**
   * Создаёт строку настроек (ленивое создание при первом обращении). Идемпотентно:
   * при существующей строке (конфликт PK) возвращает её, не падает.
   * @param accountId Идентификатор аккаунта.
   * @returns Актуальная строка настроек.
   */
  create(accountId: string): Promise<AccentSettingsFull>;

  /**
   * Ставит/снимает паузу-режим (`paused_from`).
   * @param accountId Идентификатор аккаунта.
   * @param value Момент начала паузы или null (снять).
   * @returns Обновлённая строка настроек.
   */
  updatePausedFrom(accountId: string, value: Date | null): Promise<AccentSettingsFull>;

  /**
   * Атомарно «занимает» право засеять стартовый набор микро-побед: ставит
   * `starter_micro_wins_seeded_at = now()` ТОЛЬКО если оно было null (CAS, защита от
   * гонки/двойного сева). Строка настроек должна уже существовать (вызвать getOrCreate).
   * @param accountId Идентификатор аккаунта.
   * @returns true если право получено (сеять должен вызывающий), false если уже засеяно.
   */
  claimMicroWinsStarter(accountId: string): Promise<boolean>;
}

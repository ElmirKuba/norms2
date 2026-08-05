import type { FeatureFlags } from './feature-flags.interface';

/** Публичные строки Telegram-области. */
export interface TelegramPublicView {
  /** Имя бота без `@` или пустая строка. */
  botUsername: string;
  /** Ссылка на бота или пустая строка, если бот не настроен. */
  botUrl: string;
  /** Ссылка на канал-витрину или пустая строка. */
  channelUrl: string;
}

/**
 * Всё, что нужно приложению **до входа** (`GET /api/v1/public-config`).
 *
 * Один запрос на старте вместо обращения на область: флаги под своим ключом (что включено),
 * публичные строки — под своим (контент). Смешивать их нельзя, а грузить вместе — можно.
 */
export interface PublicConfig {
  /** Флаги площадки. */
  features: FeatureFlags;
  /** Публичные строки Telegram-области. */
  telegram: TelegramPublicView;
}

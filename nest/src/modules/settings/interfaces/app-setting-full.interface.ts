import type { AppSettingBase } from './app-setting-base.interface';

/**
 * AppSettingFull — полная строка `app_settings` (≈ строка БД, ADR-0033): Base + PK и метки.
 * Ключи 1:1 с колонками схемы.
 */
export interface AppSettingFull extends Required<AppSettingBase> {
  /** PK, uuidv7___unixmillis. */
  id: string;
  /** Когда настройка впервые задана. */
  createdAt: Date;
  /** Когда изменена в последний раз. */
  updatedAt: Date;
}

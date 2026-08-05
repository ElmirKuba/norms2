import { Injectable, computed, signal } from '@angular/core';
import type { FeatureFlags } from '../interfaces/feature-flags.interface';
import type { PublicConfig } from '../interfaces/public-config.interface';

/** Пока конфигурация не загружена — самый осторожный дефолт: invite-only и бота нет. */
const FALLBACK: PublicConfig = {
  features: { freeRegistration: false },
  telegram: { botUsername: '', botUrl: '', channelUrl: '' },
};

/**
 * Публичная конфигурация приложения (Signal). Заполняется на старте через app-initializer
 * (`GET /public-config`).
 *
 * Дефолт совпадает с дефолтом бэка и выбран по принципу «недоступность не должна открывать
 * лишнего»: регистрация считается закрытой, ссылки на бота нет.
 */
@Injectable({ providedIn: 'root' })
export class FeatureFlagsStore {
  private readonly _config = signal<PublicConfig>(FALLBACK);

  /** Вся публичная конфигурация. */
  public readonly config = this._config.asReadonly();

  /** Флаги площадки (readonly-сигнал). */
  public readonly flags = computed<FeatureFlags>(() => this._config().features);

  /** Ссылка на бота или null, если он не настроен. */
  public readonly botUrl = computed<string | null>(() => {
    const url = this._config().telegram.botUrl;
    return url === '' ? null : url;
  });

  /** Ссылка на канал или null, если он не настроен. */
  public readonly channelUrl = computed<string | null>(() => {
    const url = this._config().telegram.channelUrl;
    return url === '' ? null : url;
  });

  /**
   * Устанавливает конфигурацию (из app-initializer).
   * @param config Публичная конфигурация.
   */
  public set(config: PublicConfig): void {
    this._config.set(config);
  }
}

import { Injectable, signal } from '@angular/core';
import type { FeatureFlags } from '../interfaces/feature-flags.interface';

/**
 * Хранилище флагов площадки (Signal). Заполняется на старте через app-initializer
 * (`GET /feature-flags`). Дефолт — invite-only (как дефолт бэка), пока флаги не
 * загружены/недоступны.
 */
@Injectable({ providedIn: 'root' })
export class FeatureFlagsStore {
  private readonly _flags = signal<FeatureFlags>({ freeRegistration: false });

  /** Текущие флаги (readonly-сигнал). */
  public readonly flags = this._flags.asReadonly();

  /**
   * Устанавливает флаги (из app-initializer).
   * @param flags Флаги площадки.
   */
  public set(flags: FeatureFlags): void {
    this._flags.set(flags);
  }
}

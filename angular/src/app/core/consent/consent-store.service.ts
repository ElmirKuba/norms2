import { Injectable, signal } from '@angular/core';

/** Ключ хранения согласия на технические cookie. */
const STORAGE_KEY = 'norms2.cookieConsent';

/**
 * Хранилище cookie-согласия (Signal, ADR-0024). До согласия приложение не
 * рендерит роуты (блокирующий гейт в `App`). Согласие — в localStorage.
 */
@Injectable({ providedIn: 'root' })
export class ConsentStore {
  private readonly _granted = signal<boolean>(this._read());

  /** Дано ли согласие (readonly-сигнал). */
  public readonly granted = this._granted.asReadonly();

  /** Фиксирует согласие. */
  public grant(): void {
    this._granted.set(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* приватный режим — останется на эту сессию */
    }
  }

  private _read(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}

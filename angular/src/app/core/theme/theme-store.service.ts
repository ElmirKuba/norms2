import { Injectable, signal } from '@angular/core';

/** Режим темы. */
export type ThemeMode = 'dark' | 'light';

/** Ключ хранения выбора темы. */
const STORAGE_KEY = 'norms2.theme';

/**
 * Хранилище темы (Signal): применяет класс `.theme-light` на `<html>` и хранит
 * выбор в localStorage. Дефолт — тёмная (ADR-0025). Токены (`_tokens.scss`)
 * переопределяются под классом темы — компоненты ничего не пересчитывают.
 */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly _mode = signal<ThemeMode>(this._readInitial());

  /** Текущий режим (readonly-сигнал). */
  public readonly mode = this._mode.asReadonly();

  public constructor() {
    this._apply(this._mode());
  }

  /** Переключает тёмная↔светлая. */
  public toggle(): void {
    this.set(this._mode() === 'dark' ? 'light' : 'dark');
  }

  /**
   * Устанавливает режим, применяет и сохраняет.
   * @param mode Режим темы.
   */
  public set(mode: ThemeMode): void {
    this._mode.set(mode);
    this._apply(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* приватный режим/недоступный storage — игнорируем */
    }
  }

  /**
   * Применяет тему к корню документа.
   * @param mode Режим темы.
   */
  private _apply(mode: ThemeMode): void {
    document.documentElement.classList.toggle('theme-light', mode === 'light');
  }

  /**
   * Читает сохранённый выбор; иначе — тёмная по умолчанию.
   * @returns Начальный режим.
   */
  private _readInitial(): ThemeMode {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* игнорируем */
    }
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  }
}

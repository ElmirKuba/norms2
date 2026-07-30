import { DestroyRef, Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

/** Как часто максимум обновляемся (мс) — защита от серии переключений окна. */
const THROTTLE_MS = 10_000;
/** Данные моложе этого считаются свежими и не перезапрашиваются (мс). */
const FRESH_MS = 5_000;

/**
 * Свежесть данных при возврате к вкладке (2.7.1, [ADR-0061](../../../../docs/decisions/0061-cross-device-data-freshness.md)).
 *
 * Боль: отметил привычку с телефона — на десктопе она висит невыполненной до ручной перезагрузки.
 * Экран врёт, и человек кликает по вранью. Решение без WebSocket и без опроса по таймеру:
 * **обновляемся, когда человек возвращает внимание к вкладке** (`visibilitychange`, `focus`,
 * `online`). Пока вкладка в фоне — трафика ноль.
 *
 * Почему не рефетчим слепо на каждое событие:
 * - **троттл** — переключение окон подряд не должно давать очередь запросов;
 * - **порог свежести** — только что загруженные данные перезапрашивать незачем;
 * - **счётчик занятости** — если открыт диалог, летит мутация, идёт таймер или в форме
 *   несохранённый ввод, обновление **откладывается** до освобождения: подменить данные под руками
 *   хуже, чем показать их на несколько секунд позже.
 *
 * Экран регистрирует один колбэк перезагрузки и снимает регистрацию при уничтожении. Реестра
 * секций и серверной ревизии здесь намеренно нет — это вторая часть патча, вместе с дашбордом.
 */
@Injectable({ providedIn: 'root' })
export class DataFreshnessService {
  private readonly _dialog = inject(MatDialog);

  /** Зарегистрированные колбэки перезагрузки (по одному на активный экран). */
  private readonly _reloaders = new Set<() => void>();
  /** Ручные «замки занятости» (мутация в полёте, идущий таймер, грязная форма). */
  private _busyCount = 0;
  /** Когда последний раз обновляли (мс эпохи). */
  private _lastReload = 0;
  /** Есть отложенное обновление — выполнить, как только освободимся. */
  private _pending = false;
  /** Слушатели навешены (ставим лениво, при первой регистрации). */
  private _listening = false;

  /**
   * Подписывает экран на обновление при возврате внимания.
   * @param reload Колбэк перезагрузки данных экрана (тихий, без спиннера).
   * @returns Функция снятия подписки.
   */
  public register(reload: () => void): () => void {
    this._reloaders.add(reload);
    this._ensureListening();
    return () => this._reloaders.delete(reload);
  }

  /**
   * Подписывает экран и снимает подписку автоматически при его уничтожении.
   * @param destroyRef `DestroyRef` компонента.
   * @param reload Колбэк перезагрузки.
   */
  public registerFor(destroyRef: DestroyRef, reload: () => void): void {
    const off = this.register(reload);
    destroyRef.onDestroy(off);
  }

  /**
   * Занимает «замок»: пока он держится, обновление откладывается. Вызывать перед мутацией или
   * началом фокус-режима.
   * @returns Функция освобождения (idempotent — повторный вызов ничего не делает).
   */
  public hold(): () => void {
    this._busyCount += 1;
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      this._busyCount = Math.max(0, this._busyCount - 1);
      if (this._pending && !this._isBusy()) {
        this._pending = false;
        this._reload();
      }
    };
  }

  /** Помечает данные свежими (например, экран только что загрузился сам). */
  public markFresh(): void {
    this._lastReload = Date.now();
  }

  /** Навешивает слушатели один раз на всё приложение. */
  private _ensureListening(): void {
    if (this._listening) {
      return;
    }
    this._listening = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._request();
      }
    });
    window.addEventListener('focus', () => this._request());
    // Вернулась сеть — данные могли уйти вперёд, пока нас не было.
    window.addEventListener('online', () => this._request());
  }

  /** Занят ли пользователь: открытый диалог или удержанный «замок». */
  private _isBusy(): boolean {
    return this._busyCount > 0 || this._dialog.openDialogs.length > 0;
  }

  /** Решает, обновляться ли сейчас, отложить или пропустить. */
  private _request(): void {
    if (this._reloaders.size === 0) {
      return;
    }
    const now = Date.now();
    if (now - this._lastReload < FRESH_MS) {
      return;
    }
    if (this._isBusy()) {
      this._pending = true;
      return;
    }
    if (now - this._lastReload < THROTTLE_MS) {
      return;
    }
    this._reload();
  }

  /** Дёргает все зарегистрированные перезагрузки. */
  private _reload(): void {
    this._lastReload = Date.now();
    for (const reload of this._reloaders) {
      reload();
    }
  }
}

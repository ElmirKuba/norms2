import { Injectable, computed, signal } from '@angular/core';
import type { AccountRead } from '../interfaces/account-read.interface';

/**
 * Хранилище аутентификации (Signal). Access-токен — ТОЛЬКО в памяти (не в
 * localStorage, ADR-0020); refresh живёт в httpOnly-cookie (JS не видит).
 * Потребители: interceptor (Bearer + 401→refresh, F1.4), guard, app-shell.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _account = signal<AccountRead | null>(null);
  private readonly _accessToken = signal<string | null>(null);

  /** Текущий аккаунт (readonly-сигнал) или null. */
  public readonly account = this._account.asReadonly();
  /** Access-токен (readonly-сигнал) или null. */
  public readonly accessToken = this._accessToken.asReadonly();
  /** Признак аутентификации (есть access-токен). */
  public readonly isAuthenticated = computed(() => this._accessToken() !== null);

  /**
   * Есть ли у текущего аккаунта роль администратора (2.9.3·8).
   *
   * ⚠️ Только для показа пункта меню и раздела. Данные это не защищает — их защищает бэк
   * (`RolesGuard`, отказ 404). Поэтому здесь не «можно ли», а «показывать ли».
   */
  public readonly isAdmin = computed(() => this._account()?.roles.includes('admin') === true);

  /**
   * Устанавливает сессию после login/реактивации.
   * @param account Аккаунт.
   * @param accessToken Access-JWT.
   */
  public setSession(account: AccountRead, accessToken: string): void {
    this._account.set(account);
    this._accessToken.set(accessToken);
  }

  /**
   * Обновляет access-токен (после refresh).
   * @param accessToken Новый access-JWT.
   */
  public setAccessToken(accessToken: string): void {
    this._accessToken.set(accessToken);
  }

  /**
   * Обновляет данные аккаунта (после правки профиля).
   * @param account Аккаунт.
   */
  public setAccount(account: AccountRead): void {
    this._account.set(account);
  }

  /** Сбрасывает сессию (logout / провал refresh). */
  public clear(): void {
    this._account.set(null);
    this._accessToken.set(null);
  }
}

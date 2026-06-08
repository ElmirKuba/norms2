import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { AccountRead } from '../../../core/interfaces/account-read.interface';
import type { AccountPublicView } from '../profile.types';

/**
 * API-сервис области `accounts` (`/api/v1/accounts/*`): управление СВОИМ профилем
 * + чтение чужого. Тонкая обёртка над HttpClient (base/credentials/Bearer/refresh
 * добавляет `authInterceptor`). `me()` живёт в `AuthApiService` (нужен auth-флоу
 * до наполнения стора) — здесь не дублируется; свой профиль читаем из `AuthStore`.
 */
@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly _http = inject(HttpClient);

  /** Публичный профиль участника по логину. */
  public getByLogin(login: string): Observable<AccountPublicView> {
    return this._http.get<AccountPublicView>(`${API_PREFIX}/accounts/${encodeURIComponent(login)}`);
  }

  /** Смена своего псевдонима → обновлённый профиль. */
  public updateAlias(alias: string): Observable<AccountRead> {
    return this._http.patch<AccountRead>(`${API_PREFIX}/accounts/me`, { alias });
  }

  /** Деактивация своего аккаунта (обратимо, ADR-0017). */
  public deactivate(): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/accounts/me/deactivate`, null);
  }

  /** Soft-удаление своего аккаунта (без UI-восстановления, ADR-0017). */
  public deleteMe(): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/accounts/me`);
  }

  /** Загрузка аватарки (multipart, поле `file`) → обновлённый профиль (F3.3). */
  public uploadAvatar(file: File): Observable<AccountRead> {
    const form = new FormData();
    form.append('file', file);
    return this._http.post<AccountRead>(`${API_PREFIX}/accounts/me/avatar`, form);
  }

  /** Удаление аватарки → обновлённый профиль (F3.3). */
  public removeAvatar(): Observable<AccountRead> {
    return this._http.delete<AccountRead>(`${API_PREFIX}/accounts/me/avatar`);
  }
}

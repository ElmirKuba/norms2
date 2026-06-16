import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { AccentSettingsView } from '../accent.types';

/** API-сервис раздела «Акцент» (`/api/v1/accent/*`): настройки + пауза-режим (2.0.0). */
@Injectable({ providedIn: 'root' })
export class AccentApiService {
  private readonly _http = inject(HttpClient);

  /** Настройки раздела (ленивое создание на бэке). */
  public getSettings(): Observable<AccentSettingsView> {
    return this._http.get<AccentSettingsView>(`${API_PREFIX}/accent/settings`);
  }

  /** Поставить раздел на паузу (заморозка серий/ролловера). */
  public pause(): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/accent/pause`, {});
  }

  /** Снять паузу. */
  public resume(): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/accent/resume`, {});
  }
}

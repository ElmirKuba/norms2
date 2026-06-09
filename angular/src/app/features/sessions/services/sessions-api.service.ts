import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { SessionView } from '../sessions.types';

/**
 * API-сервис области sessions (`/api/v1/sessions/*`): список устройств, отзыв
 * одного, «выйти на остальных». `current` помечает сервер (sid из JWT, ADR-0041).
 */
@Injectable({ providedIn: 'root' })
export class SessionsApiService {
  private readonly _http = inject(HttpClient);

  /** Мои активные сессии (устройства). */
  public listMine(): Observable<SessionView[]> {
    return this._http.get<SessionView[]>(`${API_PREFIX}/sessions`);
  }

  /** Отозвать одну сессию по id (завершить устройство). */
  public revoke(id: string): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/sessions/${encodeURIComponent(id)}`);
  }

  /** Завершить все сессии, кроме текущей. */
  public revokeOthers(): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/sessions/others`);
  }
}

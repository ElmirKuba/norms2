import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { BanView, BanListItem } from '../bans.types';

/**
 * API-сервис области bans (`/api/v1/bans/*`): поставить бан (из карточки участника),
 * список своих банов (с именем цели), снять бан.
 */
@Injectable({ providedIn: 'root' })
export class BansApiService {
  private readonly _http = inject(HttpClient);

  /** Забанить цель (право — только в своём поддереве; иначе `BAN_FORBIDDEN`). */
  public create(targetId: string, reason: string): Observable<BanView> {
    return this._http.post<BanView>(`${API_PREFIX}/bans`, { targetId, reason });
  }

  /** Мои баны (вкл. историю снятых), с login/alias цели. */
  public listMine(): Observable<BanListItem[]> {
    return this._http.get<BanListItem[]>(`${API_PREFIX}/bans`);
  }

  /** Снять свой бан по id записи. */
  public unban(id: string): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/bans/${encodeURIComponent(id)}`);
  }
}

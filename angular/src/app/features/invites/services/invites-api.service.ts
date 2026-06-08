import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { InviterRead } from '../invites.types';

/**
 * API-сервис области invites (`/api/v1/invites/*`). Пока — только «кто меня
 * пригласил» (для профиля, F3.2); создание/отзыв/список — F3.4.
 */
@Injectable({ providedIn: 'root' })
export class InvitesApiService {
  private readonly _http = inject(HttpClient);

  /** «Кто меня пригласил» (обратное ребро). null у корней дерева (free/seed). */
  public myInviter(): Observable<InviterRead | null> {
    return this._http.get<InviterRead | null>(`${API_PREFIX}/invites/my-inviter`);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type {
  InviterRead,
  InviteeRead,
  InviteCodeRead,
  InviteeNode,
  CanBanResponse,
} from '../invites.types';

/**
 * API-сервис области invites (`/api/v1/invites/*`): кто пригласил (F3.2) +
 * создание/отзыв кодов, списки невыданных кодов и приглашённых (F3.4).
 */
@Injectable({ providedIn: 'root' })
export class InvitesApiService {
  private readonly _http = inject(HttpClient);

  /** «Кто меня пригласил» (обратное ребро). null у корней дерева (free/seed). */
  public myInviter(): Observable<InviterRead | null> {
    return this._http.get<InviterRead | null>(`${API_PREFIX}/invites/my-inviter`);
  }

  /** Мои приглашённые (уже зарегистрировавшиеся). */
  public listInvitees(): Observable<InviteeRead[]> {
    return this._http.get<InviteeRead[]>(`${API_PREFIX}/invites`);
  }

  /** Мои невыданные коды (активные). */
  public listCodes(): Observable<InviteCodeRead[]> {
    return this._http.get<InviteCodeRead[]>(`${API_PREFIX}/invites/codes`);
  }

  /** Создать код приглашения (списывает квоту). */
  public create(reason: string): Observable<InviteCodeRead> {
    return this._http.post<InviteCodeRead>(`${API_PREFIX}/invites`, { reason });
  }

  /** Отозвать свой невыданный код (возвращает квоту). */
  public revoke(id: string): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/invites/${encodeURIComponent(id)}`);
  }

  /** Прямые дети узла дерева (ленивое раскрытие; узел = я или моё поддерево). */
  public listOf(accountId: string): Observable<InviteeNode[]> {
    return this._http.get<InviteeNode[]>(`${API_PREFIX}/invites/of/${encodeURIComponent(accountId)}`);
  }

  /** Вправе ли я забанить этот аккаунт (для видимости кнопки). */
  public canBan(accountId: string): Observable<CanBanResponse> {
    return this._http.get<CanBanResponse>(`${API_PREFIX}/invites/can-ban/${encodeURIComponent(accountId)}`);
  }
}

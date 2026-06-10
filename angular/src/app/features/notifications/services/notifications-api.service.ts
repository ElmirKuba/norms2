import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { NotificationView, UnreadCountResponse } from '../notifications.types';

/**
 * API-сервис уведомлений (`/api/v1/notifications/*`, F5.6) + загрузка рич-контента
 * `.md` из статики бэка (`/content/<contentFile>`). Базовый URL/Bearer/credentials
 * добавляет `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly _http = inject(HttpClient);

  /** Мои уведомления (broadcast + персональные), новые сверху. */
  public list(): Observable<NotificationView[]> {
    return this._http.get<NotificationView[]>(`${API_PREFIX}/notifications`);
  }

  /** Число непрочитанных (для бейджа). */
  public unreadCount(): Observable<UnreadCountResponse> {
    return this._http.get<UnreadCountResponse>(`${API_PREFIX}/notifications/unread-count`);
  }

  /**
   * Отмечает одно уведомление прочитанным.
   * @param id Идентификатор.
   */
  public markRead(id: string): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/notifications/${id}/read`, null);
  }

  /** Отмечает все мои непрочитанные прочитанными. */
  public markAllRead(): Observable<void> {
    return this._http.post<void>(`${API_PREFIX}/notifications/read-all`, null);
  }

  /**
   * Загружает рич-контент уведомления (`.md`) из статики бэка.
   * @param contentFile Путь относительно content/ (из `NotificationView.contentFile`).
   * @returns Сырой Markdown-текст.
   */
  public fetchContent(contentFile: string): Observable<string> {
    return this._http.get(`/content/${contentFile}`, { responseType: 'text' });
  }
}

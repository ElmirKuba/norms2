import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { TelegramLinkCodeView, TelegramLinkStatus } from '../telegram-link.types';

/**
 * API-сервис привязки Telegram (`/api/v1/telegram/link`, под Guard).
 *
 * Идентификатор чата сюда не приходит вовсе — бэк его не отдаёт: экрану он не нужен, а это
 * идентификатор человека в чужом сервисе.
 */
@Injectable({ providedIn: 'root' })
export class TelegramLinkApiService {
  private readonly _http = inject(HttpClient);

  /** Состояние привязки текущего аккаунта. */
  public status(): Observable<TelegramLinkStatus> {
    return this._http.get<TelegramLinkStatus>(`${API_PREFIX}/telegram/link`);
  }

  /** Выдать одноразовый код привязки. */
  public issueCode(): Observable<TelegramLinkCodeView> {
    return this._http.post<TelegramLinkCodeView>(`${API_PREFIX}/telegram/link/code`, {});
  }

  /** Отвязать чат от аккаунта. */
  public unlink(): Observable<void> {
    return this._http.delete<void>(`${API_PREFIX}/telegram/link`);
  }
}

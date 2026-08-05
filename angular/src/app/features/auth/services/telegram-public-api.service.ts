import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { TelegramPublicView } from '../auth.types';

/**
 * Публичные строки Telegram-области (`GET /telegram/public`, без авторизации).
 *
 * Нужны странице регистрации: человеку без кода надо куда-то пойти за заявкой. Ссылка приходит
 * с бэка, а не зашита здесь, — на стейдже и проде боты разные.
 */
@Injectable({ providedIn: 'root' })
export class TelegramPublicApiService {
  private readonly _http = inject(HttpClient);

  /** Имя бота и ссылка на него. */
  public view(): Observable<TelegramPublicView> {
    return this._http.get<TelegramPublicView>(`${API_PREFIX}/telegram/public`);
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { ReleaseView } from '../releases.types';

/**
 * API публичной витрины релизов (`/api/v1/releases`, 2.9.1·4). Всё открыто:
 * авторизация не нужна ни для списка, ни для одной ноты, ни для `.md`.
 *
 * Здесь нет и не должно появиться отметок о прочтении — они живут в
 * `NotificationsApiService` и относятся к личному кабинету. Витрину читают
 * анонимно, приписывать это чтение некому.
 */
@Injectable({ providedIn: 'root' })
export class ReleasesApiService {
  private readonly _http = inject(HttpClient);

  /**
   * Все релизные ноты, новые сверху.
   * @returns Список проекций витрины.
   */
  public list(): Observable<ReleaseView[]> {
    return this._http.get<ReleaseView[]>(`${API_PREFIX}/releases`);
  }

  /**
   * Одна нота по публичному ключу.
   * @param key Ключ (`release-2.9.0`).
   * @returns Проекция витрины.
   */
  public byKey(key: string): Observable<ReleaseView> {
    return this._http.get<ReleaseView>(`${API_PREFIX}/releases/${key}`);
  }

  /**
   * Загружает текст ноты (`.md`) из статики бэка.
   * @param contentFile Путь относительно `content/`.
   * @returns Сырой Markdown.
   */
  public fetchContent(contentFile: string): Observable<string> {
    return this._http.get(`/content/${contentFile}`, { responseType: 'text' });
  }
}

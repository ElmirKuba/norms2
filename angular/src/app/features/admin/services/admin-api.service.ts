import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { AdminSetting } from '../admin.types';

/**
 * API-сервис технической админки (`/api/v1/admin/*`, 2.9.3).
 *
 * ⚠️ **Без роли весь этот префикс отдаёт 404**, а не 403 — так решено на бэке, чтобы перебор
 * адресов не рисовал карту админки. Значит «не найдено» здесь означает «нет прав» ничуть не
 * меньше, чем «нет такой ручки», и обрабатывать их одинаково — правильно.
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly _http = inject(HttpClient);

  /**
   * Редактируемые рантайм-настройки с происхождением значения.
   * @returns Поток описаний настроек.
   */
  public listSettings(): Observable<AdminSetting[]> {
    return this._http.get<AdminSetting[]>(`${API_PREFIX}/admin/settings`);
  }

  /**
   * Меняет значение настройки.
   * @param key Ключ настройки.
   * @param value Новое значение строкой.
   * @returns Поток нового состояния настройки.
   */
  public updateSetting(key: string, value: string): Observable<AdminSetting> {
    return this._http.put<AdminSetting>(
      `${API_PREFIX}/admin/settings/${encodeURIComponent(key)}`,
      { value },
    );
  }
}

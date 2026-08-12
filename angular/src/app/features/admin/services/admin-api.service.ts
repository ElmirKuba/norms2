import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { AdminAccount, AdminAccountPage, AdminSetting } from '../admin.types';

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

  /**
   * Страница людей с ролями.
   * @param query Подстрока логина или псевдонима.
   * @param cursor Курсор предыдущей страницы или null.
   * @returns Поток страницы.
   */
  public listAccounts(query: string, cursor: string | null): Observable<AdminAccountPage> {
    const params: Record<string, string> = {};
    if (query !== '') {
      params['query'] = query;
    }
    if (cursor !== null) {
      params['cursor'] = cursor;
    }
    return this._http.get<AdminAccountPage>(`${API_PREFIX}/admin/accounts`, { params });
  }

  /**
   * Выдаёт роль.
   * @param accountId Кому.
   * @param code Код роли.
   * @returns Поток обновлённой строки.
   */
  public grantRole(accountId: string, code: string): Observable<AdminAccount> {
    return this._http.post<AdminAccount>(`${API_PREFIX}/admin/accounts/${accountId}/roles`, { code });
  }

  /**
   * Снимает роль.
   * @param accountId У кого.
   * @param code Код роли.
   * @returns Поток обновлённой строки.
   */
  public revokeRole(accountId: string, code: string): Observable<AdminAccount> {
    return this._http.delete<AdminAccount>(
      `${API_PREFIX}/admin/accounts/${accountId}/roles/${encodeURIComponent(code)}`,
    );
  }
}

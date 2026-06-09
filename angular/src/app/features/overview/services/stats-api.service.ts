import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { API_PREFIX } from '../../../core/config/api.constants';
import type { OverviewStats } from '../overview.types';

/** API-сервис статистики (`/api/v1/stats/*`): агрегаты для главного экрана (F4). */
@Injectable({ providedIn: 'root' })
export class StatsApiService {
  private readonly _http = inject(HttpClient);

  /** Числа для overview одним запросом. */
  public overview(): Observable<OverviewStats> {
    return this._http.get<OverviewStats>(`${API_PREFIX}/stats/overview`);
  }
}

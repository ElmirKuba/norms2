import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_PREFIX } from '../config/api.constants';
import { environment } from '../../../environments/environment';
import type { VersionInfo } from './version.types';

/**
 * Версия приложения (ADR-0044). Заголовок — версия **продукта** (из `.env` бэка,
 * через `GET /version`). В скобках — диагностика: версия фронта (из его
 * `package.json`, build-time) + версия бэка + git-SHA (runtime, что развёрнуто).
 * Грузится один раз при первом обращении (singleton); до ответа показывает версию
 * фронта как fallback продукта.
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly _http = inject(HttpClient);

  /** Версия фронта из его package.json (build-time). */
  public readonly frontendVersion = environment.frontendVersion;

  private readonly _info = signal<VersionInfo | null>(null);

  /** Версия продукта (из бэка) или версия фронта как fallback. */
  public readonly product = computed(() => this._info()?.product ?? this.frontendVersion);

  /** Диагностическая строка: front X · back Y · commit (что есть). */
  public readonly diagnostics = computed(() => {
    const parts = [`front ${this.frontendVersion}`];
    const info = this._info();
    if (info !== null) {
      parts.push(`back ${info.backend}`);
      if (info.commit !== '') {
        parts.push(info.commit);
      }
    }
    return parts.join(' · ');
  });

  public constructor() {
    this._load();
  }

  private _load(): void {
    this._http.get<VersionInfo>(`${API_PREFIX}/version`).subscribe({
      next: (info) => this._info.set(info),
      error: () => undefined,
    });
  }
}

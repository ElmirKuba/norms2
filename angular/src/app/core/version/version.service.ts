import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_PREFIX } from '../config/api.constants';
import type { VersionInfo } from './version.types';

/**
 * Версия приложения (ADR-0044, пересмотр 2026-06-15). Единственная значимая
 * версия — продукта «Нормисы» (файл `VERSION` на бэке, через `GET /version`).
 * `commit` — диагностика (что реально развёрнуто). Версии фронта/бэка
 * зафиксированы на 1.0.0 и не показываются. Грузится один раз (singleton).
 */
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly _http = inject(HttpClient);

  private readonly _info = signal<VersionInfo | null>(null);

  /** Версия продукта (из бэка) или '' до загрузки. */
  public readonly product = computed(() => this._info()?.product ?? '');

  /** Диагностика: git-SHA развёрнутого билда (или '' — нет/не загружено). */
  public readonly diagnostics = computed(() => this._info()?.commit ?? '');

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

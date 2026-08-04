import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { ReleasesApiService } from '../services/releases-api.service';
import type { ReleaseView } from '../releases.types';

/**
 * Публичная витрина релизов (`/releases`, 2.9.1·4) — список выпусков, новые сверху.
 * Открыта без авторизации: до неё проект снаружи выглядел мёртвым — лендинг без единого
 * следа того, что продукт развивается ([ADR-0064](https://github.com/ElmirKuba/norms2)).
 *
 * Отметок о прочтении здесь нет намеренно: их механика принадлежит личному кабинету.
 */
@Component({
  selector: 'app-releases-list',
  imports: [DatePipe, RouterLink, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './releases-list.component.html',
  styleUrl: './releases-list.component.scss',
})
export class ReleasesListComponent {
  private readonly _api = inject(ReleasesApiService);

  /** Загруженные релизы (новые сверху). */
  protected readonly releases = signal<ReleaseView[]>([]);
  /** Идёт загрузка списка. */
  protected readonly loading = signal(true);
  /** Список не загрузился. */
  protected readonly failed = signal(false);

  public constructor() {
    this._api.list().subscribe({
      next: (releases) => {
        this.releases.set(releases);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /**
   * Номер версии для показа крупно: `release-2.9.0` → `2.9.0`.
   * @param key Ключ ноты.
   * @returns Версия или сам ключ, если форма неожиданная.
   */
  protected version(key: string): string {
    return key.startsWith('release-') ? key.slice('release-'.length) : key;
  }
}

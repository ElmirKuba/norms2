import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { renderMarkdown, stripLeadingHeading } from '../../notifications/md-render.util';
import { FeatureFlagsStore } from '../../../core/feature-flags/feature-flags-store.service';
import { ReleasesApiService } from '../services/releases-api.service';
import type { ReleaseView } from '../releases.types';

/**
 * Одна релиз-нота на публичной витрине (`/releases/:key`, 2.9.1·4). Сюда ведёт ссылка
 * из поста в Telegram-канале: пост несёт тезисы, полный текст — здесь.
 *
 * Текст рендерится тем же `renderMarkdown`, что и модалка в личном кабинете, и теми же
 * глобальными стилями `.md`: одна нота не должна выглядеть по-разному внутри и снаружи.
 * Стили именно глобальные, а не компонентные — элементы из `[innerHTML]` не получают
 * атрибут инкапсуляции Angular, и правила компонента до них не долетают.
 *
 * Прочитанным ничего не отмечается: витрина открыта анонимно.
 */
@Component({
  selector: 'app-release-detail',
  imports: [DatePipe, RouterLink, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './release-detail.component.html',
  styleUrl: './release-detail.component.scss',
})
export class ReleaseDetailComponent {
  private readonly _route = inject(ActivatedRoute);
  private readonly _api = inject(ReleasesApiService);
  private readonly _config = inject(FeatureFlagsStore);

  /** Ссылка на канал-витрину или null, если он на этом стенде не настроен. */
  protected readonly channelUrl = this._config.channelUrl;
  /** Ссылка на бота или null. */
  protected readonly botUrl = this._config.botUrl;

  /** Ключ ноты из маршрута (`/releases/:key`). */
  protected readonly key = this._route.snapshot.paramMap.get('key') ?? '';

  /** Загруженная нота. */
  protected readonly release = signal<ReleaseView | null>(null);
  /** Готовый HTML текста. */
  protected readonly html = signal<string | null>(null);
  /** Идёт загрузка. */
  protected readonly loading = signal(true);
  /** Ноты нет или не загрузилась. */
  protected readonly failed = signal(false);

  public constructor() {
    this._load(this.key);
  }

  private _load(key: string): void {
    this._api.byKey(key).subscribe({
      next: (release) => {
        this.release.set(release);
        if (release.contentFile !== null && release.contentFile !== '') {
          this._loadContent(release.contentFile);
        } else {
          this.html.set(renderMarkdown(release.body ?? ''));
          this.loading.set(false);
        }
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  private _loadContent(contentFile: string): void {
    this._api.fetchContent(contentFile).subscribe({
      next: (markdown) => {
        this.html.set(renderMarkdown(stripLeadingHeading(markdown)));
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}

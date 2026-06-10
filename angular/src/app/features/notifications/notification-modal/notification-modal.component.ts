import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationsApiService } from '../services/notifications-api.service';
import { renderMarkdown } from '../md-render.util';
import type { NotificationView } from '../notifications.types';

/** Данные модалки просмотра уведомления. */
export interface NotificationModalData {
  /** Уведомление к показу. */
  notification: NotificationView;
}

/**
 * Модалка просмотра уведомления (F5.6). Источник контента: `body` (inline) ИЛИ
 * `contentFile` (`.md` грузится из статики бэка и рендерится мини-рендером). HTML
 * биндится `[innerHTML]` — `renderMarkdown` экранирует вход, Angular санитайзит.
 */
@Component({
  selector: 'app-notification-modal',
  imports: [ButtonComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-modal.component.html',
  styleUrl: './notification-modal.component.scss',
})
export class NotificationModalComponent {
  private readonly _api = inject(NotificationsApiService);
  private readonly _ref = inject<MatDialogRef<NotificationModalComponent>>(MatDialogRef);
  /** Данные (уведомление). */
  protected readonly data = inject<NotificationModalData>(MAT_DIALOG_DATA);

  /** Готовый HTML контента или null (пока грузится/ошибка). */
  protected readonly html = signal<string | null>(null);
  /** Идёт загрузка `.md`. */
  protected readonly loading = signal(false);
  /** Ошибка загрузки контента. */
  protected readonly failed = signal(false);

  /** Заголовок уведомления. */
  protected readonly title = computed(() => this.data.notification.title);

  public constructor() {
    const notification = this.data.notification;
    if (notification.contentFile !== null && notification.contentFile !== '') {
      this._loadContent(notification.contentFile);
    } else {
      this.html.set(renderMarkdown(notification.body ?? ''));
    }
  }

  /** Закрывает модалку. */
  protected close(): void {
    this._ref.close();
  }

  private _loadContent(contentFile: string): void {
    this.loading.set(true);
    this._api.fetchContent(contentFile).subscribe({
      next: (markdown) => {
        this.html.set(renderMarkdown(markdown));
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NotificationsStore } from '../services/notifications-store.service';
import { NotificationModalService } from '../services/notification-modal.service';
import type { NotificationView } from '../notifications.types';

/**
 * Колокол уведомлений в шапке `/app` (F5.6): бейдж непрочитанных + выпадающая
 * панель-центр (список, отметка прочитанным по клику, «прочитать все»). Открытие
 * панели грузит список и сверяет счётчик. Поллингом счётчика управляет каркас.
 */
@Component({
  selector: 'app-notification-bell',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent {
  /** Стор уведомлений (счётчик/список/загрузка). */
  protected readonly store = inject(NotificationsStore);
  private readonly _modal = inject(NotificationModalService);

  /** Открыта ли панель. */
  protected readonly open = signal(false);

  /** Переключает панель; при открытии — грузит список. */
  protected toggle(): void {
    const next = !this.open();
    this.open.set(next);
    if (next) {
      this.store.loadList();
    }
  }

  /** Закрывает панель. */
  protected close(): void {
    this.open.set(false);
  }

  /**
   * Клик по уведомлению: отмечает прочитанным и открывает модалку с контентом.
   *
   * **Панель НЕ закрываем** (реш. Elmir 04.08.2026). Раньше закрывали, и человек, закрыв
   * подробности, оказывался ни с чем — приходилось снова целиться в колокольчик. Переоткрывать
   * панель после `afterClosed()` тоже нельзя: список отрисуется заново и **прокрутка улетит
   * наверх**, а читали, скажем, девятую ноту снизу. Поэтому панель просто живёт под модалкой:
   * CDK-overlay рисуется выше (z-index 1000 против наших 10/11), клики мимо модалки до нашего
   * backdrop не доходят, а скролл списка сохраняется сам собой.
   * @param notification Уведомление.
   */
  protected select(notification: NotificationView): void {
    this.store.markRead(notification.id);
    this._modal.open(notification);
  }

  /** Отмечает все прочитанными. */
  protected markAll(): void {
    this.store.markAllRead();
  }

  /**
   * Человекочитаемая дата уведомления.
   * @param iso ISO-строка `createdAt`.
   * @returns Дата+время в локали ru-RU.
   */
  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

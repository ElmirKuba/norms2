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
   * @param notification Уведомление.
   */
  protected select(notification: NotificationView): void {
    this.store.markRead(notification.id);
    this.close();
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

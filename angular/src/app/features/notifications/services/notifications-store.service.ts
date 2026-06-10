import { Injectable, inject, signal } from '@angular/core';
import { NotificationsApiService } from './notifications-api.service';
import type { NotificationView } from '../notifications.types';

/** Период фонового опроса счётчика непрочитанных (мс). */
const POLL_INTERVAL_MS = 60_000;

/**
 * Signal-стор центра уведомлений (F5.6). Держит счётчик непрочитанных (бейдж),
 * список (загружается при открытии панели) и состояние загрузки. Реалтайм — лёгкий
 * поллинг счётчика (SSE/WS отложены). Оптимистично обновляет `read`/счётчик на
 * отметках. Запуск/останов поллинга — из каркаса `/app` по факту аутентификации.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly _api = inject(NotificationsApiService);

  private readonly _unread = signal(0);
  private readonly _items = signal<readonly NotificationView[]>([]);
  private readonly _loading = signal(false);

  /** Непрочитанных (для бейджа). */
  public readonly unread = this._unread.asReadonly();
  /** Текущий список. */
  public readonly items = this._items.asReadonly();
  /** Идёт загрузка списка. */
  public readonly loading = this._loading.asReadonly();

  private _timer: ReturnType<typeof setInterval> | null = null;

  /** Запускает поллинг счётчика (идемпотентно): сразу + раз в минуту. */
  public startPolling(): void {
    this.refreshCount();
    if (this._timer === null) {
      this._timer = setInterval(() => this.refreshCount(), POLL_INTERVAL_MS);
    }
  }

  /** Останавливает поллинг и сбрасывает состояние (logout). */
  public stopPolling(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._unread.set(0);
    this._items.set([]);
  }

  /** Обновляет счётчик непрочитанных с сервера. */
  public refreshCount(): void {
    this._api.unreadCount().subscribe({
      next: (response) => this._unread.set(response.count),
      error: () => undefined,
    });
  }

  /** Загружает список (при открытии панели) и заодно сверяет счётчик. */
  public loadList(): void {
    this._loading.set(true);
    this._api.list().subscribe({
      next: (items) => {
        this._items.set(items);
        this._unread.set(items.filter((item) => !item.read).length);
        this._loading.set(false);
      },
      error: () => this._loading.set(false),
    });
  }

  /**
   * Отмечает уведомление прочитанным (оптимистично, idempotent). No-op если уже read.
   * @param id Идентификатор.
   */
  public markRead(id: string): void {
    const target = this._items().find((item) => item.id === id);
    if (target === undefined || target.read) {
      return;
    }
    this._items.update((items) =>
      items.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    this._unread.update((count) => Math.max(0, count - 1));
    this._api.markRead(id).subscribe({ error: () => this.loadList() });
  }

  /** Отмечает все прочитанными (оптимистично). */
  public markAllRead(): void {
    if (this._unread() === 0) {
      return;
    }
    this._items.update((items) => items.map((item) => ({ ...item, read: true })));
    this._unread.set(0);
    this._api.markAllRead().subscribe({ error: () => this.loadList() });
  }
}

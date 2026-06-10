import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MODAL_LARGE_WIDTH, MODAL_VIEWPORT_MAX_WIDTH } from '../../../shared/modals/modals.constants';
import { NotificationModalComponent } from '../notification-modal/notification-modal.component';
import type { NotificationModalData } from '../notification-modal/notification-modal.component';
import type { NotificationView } from '../notifications.types';

/**
 * Сервис открытия модалки просмотра уведомления (ADR-0026: компоненты не дёргают
 * `MatDialog` напрямую).
 */
@Injectable({ providedIn: 'root' })
export class NotificationModalService {
  private readonly _dialog = inject(MatDialog);

  /**
   * Показывает уведомление (inline `body` или рич `.md` из `contentFile`).
   * @param notification Уведомление.
   */
  public open(notification: NotificationView): void {
    this._dialog.open<NotificationModalComponent, NotificationModalData>(NotificationModalComponent, {
      width: MODAL_LARGE_WIDTH,
      maxWidth: MODAL_VIEWPORT_MAX_WIDTH,
      data: { notification },
    });
  }
}

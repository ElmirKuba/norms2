import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import {
  MODAL_LARGE_WIDTH,
  MODAL_VIEWPORT_MAX_WIDTH,
  MODAL_VIEWPORT_MAX_HEIGHT,
} from '../../../shared/modals/modals.constants';
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
   *
   * Возвращает поток закрытия — колокольчику он нужен, чтобы снять подсветку с открытой строки.
   * Сам `MatDialogRef` наружу не отдаём: компоненты не должны знать про `MatDialog` (ADR-0026).
   * @param notification Уведомление.
   * @returns Поток, отдающий значение в момент закрытия модалки.
   */
  public open(notification: NotificationView): Observable<void> {
    const ref = this._dialog.open<NotificationModalComponent, NotificationModalData>(NotificationModalComponent, {
      width: MODAL_LARGE_WIDTH,
      maxWidth: MODAL_VIEWPORT_MAX_WIDTH,
      maxHeight: MODAL_VIEWPORT_MAX_HEIGHT,
      // full-bleed вёрстка (head/body/foot со своими паддингами+бордерами) —
      // surface не должен добавлять свой паддинг, иначе .modal вылезает за него
      // и скроллится сама рамка, а не внутренний .modal__body.
      panelClass: 'modal-flush',
      data: { notification },
    });
    return ref.afterClosed().pipe(map(() => undefined));
  }
}

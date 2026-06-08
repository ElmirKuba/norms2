import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MODAL_MEDIUM_WIDTH } from '../../../shared/modals/modals.constants';
import { AvatarViewModalComponent } from '../avatar-view/avatar-view-modal.component';
import type { AvatarViewData } from '../avatar-view/avatar-view-modal.component';

/**
 * Сервис открытия модалки просмотра аватара (ADR-0026: компоненты не дёргают
 * `MatDialog` напрямую).
 */
@Injectable({ providedIn: 'root' })
export class AvatarViewService {
  private readonly _dialog = inject(MatDialog);

  /**
   * Показывает аватар в полном размере.
   * @param url Полный URL изображения.
   * @param alt Альт-текст.
   */
  public open(url: string, alt: string): void {
    this._dialog.open<AvatarViewModalComponent, AvatarViewData>(AvatarViewModalComponent, {
      width: MODAL_MEDIUM_WIDTH,
      data: { url, alt },
    });
  }
}

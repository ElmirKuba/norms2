import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { MODAL_MEDIUM_WIDTH } from '../../../shared/modals/modals.constants';
import { AvatarCropModalComponent } from '../avatar-crop/avatar-crop-modal.component';
import type { AvatarCropData } from '../avatar-crop/avatar-crop-modal.component';

/**
 * Сервис открытия модалки кропа аватара (ADR-0042/0026): компоненты не дёргают
 * `MatDialog` напрямую. Возвращает нарезанный квадрат (`Blob`) или null (отмена).
 */
@Injectable({ providedIn: 'root' })
export class AvatarCropService {
  private readonly _dialog = inject(MatDialog);

  /**
   * Открывает кроп для выбранного файла.
   * @param file Исходное изображение.
   * @returns Нарезанный Blob (jpeg) или null, если отменено.
   */
  public async open(file: File): Promise<Blob | null> {
    const ref = this._dialog.open<AvatarCropModalComponent, AvatarCropData, Blob | null>(
      AvatarCropModalComponent,
      { width: MODAL_MEDIUM_WIDTH, disableClose: true, data: { file } },
    );
    const result = await firstValueFrom(ref.afterClosed());
    return result ?? null;
  }
}

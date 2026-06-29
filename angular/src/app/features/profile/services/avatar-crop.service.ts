import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, firstValueFrom } from 'rxjs';
import { MODAL_MEDIUM_WIDTH } from '../../../shared/modals/modals.constants';
import { AvatarCropModalComponent } from '../avatar-crop/avatar-crop-modal.component';
import type { AvatarCropData } from '../avatar-crop/avatar-crop-modal.component';

/**
 * Сервис открытия модалки кропа аватара (ADR-0042/0026): компоненты не дёргают
 * `MatDialog` напрямую. Модалка САМА грузит нарезанный файл через `submit` (закрывается лишь при
 * успехе; при ошибке остаётся открытой с уже обрезанным фото — пере-кропать не нужно, H#B2-9 класс)
 * и возвращает результат загрузки или null (отмена).
 */
@Injectable({ providedIn: 'root' })
export class AvatarCropService {
  private readonly _dialog = inject(MatDialog);

  /**
   * Открывает кроп для выбранного файла; загрузку делает сама модалка через `submit`.
   * @param file Исходное изображение.
   * @param submit Загрузка нарезанного файла (зовётся внутри модалки).
   * @returns Результат загрузки (`T`) или null, если отменено.
   */
  public async open<T>(file: File, submit: (file: File) => Observable<T>): Promise<T | null> {
    const ref = this._dialog.open<AvatarCropModalComponent, AvatarCropData, T | null>(
      AvatarCropModalComponent,
      { width: MODAL_MEDIUM_WIDTH, disableClose: true, data: { file, submit } },
    );
    const result = await firstValueFrom(ref.afterClosed());
    return result ?? null;
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../../shared/ui/button/button.component';

/** Данные модалки просмотра аватара. */
export interface AvatarViewData {
  /** Полный URL изображения. */
  url: string;
  /** Альт-текст (псевдоним). */
  alt: string;
}

/**
 * Модалка просмотра аватара в полном размере (через движок MatDialog). Только
 * показ + «Закрыть»; правка — из меню на аватаре профиля.
 */
@Component({
  selector: 'app-avatar-view-modal',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar-view-modal.component.html',
  styleUrl: './avatar-view-modal.component.scss',
})
export class AvatarViewModalComponent {
  /** Данные (url + alt). */
  protected readonly data = inject<AvatarViewData>(MAT_DIALOG_DATA);
  private readonly _ref = inject<MatDialogRef<AvatarViewModalComponent>>(MatDialogRef);

  /** Закрывает модалку. */
  protected close(): void {
    this._ref.close();
  }
}

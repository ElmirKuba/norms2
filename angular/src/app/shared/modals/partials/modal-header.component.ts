import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import type { ModalHeaderClassIcon } from '../dialog-modal/dialog-modal.types';

/**
 * Шапка модалки: CSS-рисованная иконка статуса (done/error/info/warning/preloader)
 * + заголовок (через `ng-content`). Без внешних ассетов.
 */
@Component({
  selector: 'app-modal-header',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal-header.component.html',
  styleUrl: './modal-header.component.scss',
})
export class ModalHeaderComponent {
  /** Иконка статуса (опц.). */
  public readonly classIcon = input<ModalHeaderClassIcon>();
  /** Центрировать заголовок. */
  public readonly textCenter = input(false);
}

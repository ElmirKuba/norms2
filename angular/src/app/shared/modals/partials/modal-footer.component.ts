import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

/** Подвал модалки: раскладка кнопок (в строку/столбик, прямой/обратный порядок). */
@Component({
  selector: 'app-modal-footer',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal-footer.component.html',
})
export class ModalFooterComponent {
  /** Кнопки столбиком. */
  public readonly vertically = input(false);
  /** Обратный порядок кнопок. */
  public readonly reversed = input(false);
}

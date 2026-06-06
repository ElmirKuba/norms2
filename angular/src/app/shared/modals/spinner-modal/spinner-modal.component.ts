import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

/** Данные спиннер-модалки. */
export interface SpinnerModalData {
  /** Заголовок. */
  title: string;
  /** Текст. */
  text: string;
}

/**
 * Спиннер-модалка ожидания (Способ 5): открывается и закрывается извне
 * (`const ref = modal.openLoading(...); await op(); ref.close();`).
 */
@Component({
  selector: 'app-spinner-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spinner-modal.component.html',
  styleUrl: './spinner-modal.component.scss',
})
export class SpinnerModalComponent {
  /** Данные (заголовок/текст). */
  public readonly data = inject<SpinnerModalData>(MAT_DIALOG_DATA);
}

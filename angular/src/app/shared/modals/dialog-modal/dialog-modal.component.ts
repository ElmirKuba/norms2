import { Component, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ModalHeaderComponent } from '../partials/modal-header.component';
import { ModalContentComponent } from '../partials/modal-content.component';
import { ModalFooterComponent } from '../partials/modal-footer.component';
import type { DialogModalData } from './dialog-modal.types';

/**
 * Универсальная рамка модалки (Способ A, ADR-0026): header + content (текст или
 * вложенный компонент через `NgComponentOutlet`) + footer (confirm/cancel или
 * «Закрыть»). CD = Default (колбеки могут менять состояние извне). Sync-колбек →
 * авто-закрытие; async-колбек закрывает `ref` сам.
 */
@Component({
  selector: 'app-dialog-modal',
  imports: [
    MatDialogModule,
    NgComponentOutlet,
    ModalHeaderComponent,
    ModalContentComponent,
    ModalFooterComponent,
  ],
  templateUrl: './dialog-modal.component.html',
  styleUrl: './dialog-modal.component.scss',
})
export class DialogModalComponent<T = unknown> {
  /** Конфиг модалки. */
  public readonly data = inject<DialogModalData<T>>(MAT_DIALOG_DATA);
  private readonly _dialogRef = inject<MatDialogRef<DialogModalComponent<T>>>(MatDialogRef);

  public constructor() {
    if (this.data.preventDialogClose) {
      this._dialogRef.disableClose = true;
      this._dialogRef.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
        }
      });
    }
  }

  /** Confirm: async-колбек закрывает сам; sync — закрываем автоматически. */
  public async onConfirm(): Promise<void> {
    if (this.data.confirmCallbackAsync) {
      await this.data.confirmCallbackAsync();
      return;
    }
    this.data.confirmCallback?.();
    this._dialogRef.close(true);
  }

  /** Cancel: аналогично confirm. */
  public async onCancel(): Promise<void> {
    if (this.data.cancelCallbackAsync) {
      await this.data.cancelCallbackAsync();
      return;
    }
    this.data.cancelCallback?.();
    this._dialogRef.close(false);
  }

  /** Закрыть (не-confirm режим). */
  public onClose(): void {
    this.data.closeCallback?.();
    this._dialogRef.close();
  }

  /** Динамическая блокировка кнопки confirm. */
  public isConfirmDisabled(): boolean {
    return this.data.isConfirmButtonDisabled?.() ?? false;
  }
}

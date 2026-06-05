import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';

/** Контент модалки — обёртка над `mat-dialog-content`. */
@Component({
  selector: 'app-modal-content',
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mat-dialog-content><ng-content /></mat-dialog-content>`,
})
export class ModalContentComponent {}
